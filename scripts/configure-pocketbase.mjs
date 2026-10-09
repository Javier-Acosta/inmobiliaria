import { readFile } from "node:fs/promises";

import PocketBase from "pocketbase";

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const value = line.slice(index + 1).trim().replace(/^[ '"]|[ '"]$/g, "");
        return [line.slice(0, index).trim(), value];
      }),
  );
}

const env = parseEnv(await readFile(".env.local", "utf8"));
const required = [
  "POCKETBASE_URL",
  "POCKETBASE_SUPERUSER_EMAIL",
  "POCKETBASE_SUPERUSER_PASSWORD",
];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  throw new Error(`Faltan variables en .env.local: ${missing.join(", ")}`);
}

const pb = new PocketBase(env.POCKETBASE_URL);
pb.autoCancellation(false);

async function getCollection(name) {
  try {
    return await pb.collections.getOne(name);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

try {
  await pb
    .collection("_superusers")
    .authWithPassword(env.POCKETBASE_SUPERUSER_EMAIL, env.POCKETBASE_SUPERUSER_PASSWORD);

  const existing = await getCollection("properties");

  const baseFields = [
    { name: "title", type: "text", required: true, max: 160 },
    { name: "description", type: "editor", required: true },
    {
      name: "propertyType",
      type: "select",
      required: false,
      maxSelect: 1,
      values: ["Casa", "Departamento", "Terreno", "Local", "Quinta", "Duplex"],
    },
    { name: "price", type: "number", required: true, min: 0 },
    {
      name: "currency",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["ARS", "USD"],
    },
    {
      name: "photos",
      type: "file",
      required: true,
      maxSelect: 8,
      maxSize: 5242880,
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
    { name: "locationLabel", type: "text", required: true, max: 240 },
    { name: "latitude", type: "number", required: true, min: -90, max: 90 },
    { name: "longitude", type: "number", required: true, min: -180, max: 180 },
    {
      name: "author",
      type: "relation",
      required: true,
      collectionId: "_pb_users_auth_",
      maxSelect: 1,
      cascadeDelete: false,
    },
    {
      name: "status",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["published", "draft", "sold"],
    },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  if (!existing) {
    const created = await pb.collections.create({
      name: "properties",
      type: "base",
      listRule:
        '(status = "published" || status = "sold") || (@request.auth.id != "" && author = @request.auth.id)',
      viewRule:
        '(status = "published" || status = "sold") || (@request.auth.id != "" && author = @request.auth.id)',
      createRule: '@request.auth.id != "" && author = @request.auth.id',
      updateRule: '@request.auth.id != "" && author = @request.auth.id',
      deleteRule: '@request.auth.id != "" && author = @request.auth.id',
      fields: baseFields,
      indexes: [
        "CREATE INDEX idx_properties_status_created ON properties (status, created)",
        "CREATE INDEX idx_properties_author ON properties (author)",
      ],
    });

    console.log(
      JSON.stringify(
        {
          status: "created",
          collection: created.name,
          fields: created.fields.map((field) => field.name),
        },
        null,
        2,
      ),
    );
  } else {
    const existingFieldNames = new Set(existing.fields.map((field) => field.name));
    const missingFields = baseFields.filter(
      (field) =>
        (field.name === "propertyType" ||
          field.name === "created" ||
          field.name === "updated") &&
        !existingFieldNames.has(field.name),
    );
    const updated =
      missingFields.length > 0
        ? await pb.collections.update(existing.id, {
            fields: [...existing.fields, ...missingFields],
            indexes: [
              "CREATE INDEX idx_properties_status_created ON properties (status, created)",
              "CREATE INDEX idx_properties_author ON properties (author)",
            ],
          })
        : existing;
    const sellerListRule =
      '(status = "published" || status = "sold") || (@request.auth.id != "" && author = @request.auth.id)';
    const statusField = updated.fields.find((field) => field.name === "status");
    const propertyTypeField = updated.fields.find(
      (field) => field.name === "propertyType",
    );
    const needsSoldStatus =
      statusField?.type === "select" && !statusField.values?.includes("sold");
    const needsPropertyTypeUpdate =
      propertyTypeField?.type === "select" &&
      !["Casa", "Departamento", "Terreno", "Local", "Quinta", "Duplex"].every(
        (value) => propertyTypeField.values?.includes(value),
      );
    const needsRuleUpdate =
      updated.listRule !== sellerListRule || updated.viewRule !== sellerListRule;
    const finalCollection =
      needsSoldStatus || needsPropertyTypeUpdate || needsRuleUpdate
        ? await pb.collections.update(updated.id, {
            listRule: sellerListRule,
            viewRule: sellerListRule,
            fields: updated.fields.map((field) =>
              field.name === "status"
                ? { ...field, values: ["published", "draft", "sold"] }
                : field.name === "propertyType"
                  ? {
                      ...field,
                      values: [
                        "Casa",
                        "Departamento",
                        "Terreno",
                        "Local",
                        "Quinta",
                        "Duplex",
                      ],
                    }
                : field,
            ),
            indexes: [
              "CREATE INDEX idx_properties_status_created ON properties (status, created)",
              "CREATE INDEX idx_properties_author ON properties (author)",
            ],
          })
        : updated;

    console.log(
      JSON.stringify(
        {
          status:
            missingFields.length > 0 ||
            needsSoldStatus ||
            needsPropertyTypeUpdate ||
            needsRuleUpdate
              ? "updated"
              : "exists",
          collection: finalCollection.name,
          fields: finalCollection.fields.map((field) => field.name),
        },
        null,
        2,
      ),
    );
  }

  const users = await pb.collections.getOne("users");
  let configuredGoogle = false;

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const currentProviders = users.oauth2?.providers ?? [];
    const providers = [
      ...currentProviders.filter((provider) => provider.name !== "google"),
      {
        name: "google",
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    ];

    const updatedUsers = await pb.collections.update(users.id, {
      oauth2: {
        ...(users.oauth2 ?? {}),
        enabled: true,
        mappedFields: users.oauth2?.mappedFields ?? {
          id: "",
          name: "name",
          username: "",
          avatarURL: "avatar",
        },
        providers,
      },
    });

    configuredGoogle = updatedUsers.oauth2?.providers?.some(
      (provider) => provider.name === "google",
    );
  }

  console.log(
    JSON.stringify(
      {
        usersAuth: {
          oauthEnabled: configuredGoogle || users.oauth2?.enabled || false,
          providers: configuredGoogle
            ? ["google"]
            : users.oauth2?.providers?.map((provider) => provider.name) ?? [],
          configuredGoogle,
          canConfigureGoogle:
            Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET),
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "error",
        message: error.message,
        response: error.response,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

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
const password = `Test-${Date.now()}-Aa12345`;
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const authorEmail = `author-${suffix}@example.invalid`;
const otherEmail = `other-${suffix}@example.invalid`;
const createdIds = { users: [], properties: [] };

function pbClient() {
  const pb = new PocketBase(env.POCKETBASE_URL);
  pb.autoCancellation(false);
  return pb;
}

function tinyPngFile() {
  const bytes = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
    0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65,
    84, 120, 156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 160, 31, 160, 33, 0,
    0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
  return new File([bytes], "property.png", { type: "image/png" });
}

async function createUser(email, name) {
  const pb = pbClient();
  const user = await pb.collection("users").create({
    email,
    password,
    passwordConfirm: password,
    name,
  });
  createdIds.users.push(user.id);
  await pb.collection("users").authWithPassword(email, password);
  return { pb, user };
}

async function main() {
  const superPb = pbClient();
  await superPb
    .collection("_superusers")
    .authWithPassword(env.POCKETBASE_SUPERUSER_EMAIL, env.POCKETBASE_SUPERUSER_PASSWORD);

  const author = await createUser(authorEmail, "Author Test");
  const other = await createUser(otherEmail, "Other Test");

  const anonymous = pbClient();
  let anonymousCreateRejected = false;
  try {
    await anonymous.collection("properties").create({
      title: "No auth",
      description: "No auth",
      propertyType: "Casa",
      price: 1,
      currency: "ARS",
      locationLabel: "Test",
      latitude: -28.4696,
      longitude: -65.7852,
      author: author.user.id,
      status: "published",
    });
  } catch (error) {
    anonymousCreateRejected = error.status === 403 || error.status === 400;
  }

  const data = new FormData();
  data.set("title", "Propiedad temporal de prueba");
  data.set("description", "Registro temporal para verificar reglas.");
  data.set("propertyType", "Casa");
  data.set("price", "1000");
  data.set("currency", "ARS");
  data.set("locationLabel", "San Fernando del Valle de Catamarca");
  data.set("latitude", "-28.4696");
  data.set("longitude", "-65.7852");
  data.set("author", author.user.id);
  data.set("status", "published");
  data.append("photos", tinyPngFile());

  const property = await author.pb.collection("properties").create(data);
  createdIds.properties.push(property.id);

  const otherData = new FormData();
  otherData.set("title", "Propiedad temporal de otro vendedor");
  otherData.set("description", "Registro temporal de otro vendedor.");
  otherData.set("propertyType", "Terreno");
  otherData.set("price", "2000");
  otherData.set("currency", "ARS");
  otherData.set("locationLabel", "Valle Viejo");
  otherData.set("latitude", "-28.5065");
  otherData.set("longitude", "-65.7231");
  otherData.set("author", other.user.id);
  otherData.set("status", "published");
  otherData.append("photos", tinyPngFile());
  const otherProperty = await other.pb.collection("properties").create(otherData);
  createdIds.properties.push(otherProperty.id);

  let otherUpdateRejected = false;
  try {
    await other.pb.collection("properties").update(property.id, {
      title: "Cambio no permitido",
    });
  } catch (error) {
    otherUpdateRejected = error.status === 403 || error.status === 404;
  }

  const updated = await author.pb.collection("properties").update(property.id, {
    title: "Propiedad temporal editada",
  });

  let otherSoldRejected = false;
  try {
    await other.pb.collection("properties").update(property.id, {
      status: "sold",
    });
  } catch (error) {
    otherSoldRejected = error.status === 403 || error.status === 404;
  }

  const sold = await author.pb.collection("properties").update(property.id, {
    status: "sold",
  });

  const authorList = await author.pb.collection("properties").getFullList({
    filter: author.pb.filter("author = {:author}", { author: author.user.id }),
  });

  let otherDeleteRejected = false;
  try {
    await other.pb.collection("properties").delete(property.id);
  } catch (error) {
    otherDeleteRejected = error.status === 403 || error.status === 404;
  }

  await author.pb.collection("properties").delete(property.id);
  createdIds.properties = createdIds.properties.filter((id) => id !== property.id);
  await other.pb.collection("properties").delete(otherProperty.id);
  createdIds.properties = createdIds.properties.filter((id) => id !== otherProperty.id);

  console.log(
    JSON.stringify(
      {
        anonymousCreateRejected,
        authorCreateSucceeded: Boolean(property.id),
        otherUpdateRejected,
        authorUpdateSucceeded: updated.title === "Propiedad temporal editada",
        otherSoldRejected,
        authorSoldSucceeded: sold.status === "sold",
        sellerListContainsOnlyOwnProperties:
          authorList.length === 1 && authorList[0].author === author.user.id,
        otherDeleteRejected,
        authorDeleteSucceeded: true,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  const cleanup = pbClient();
  await cleanup
    .collection("_superusers")
    .authWithPassword(env.POCKETBASE_SUPERUSER_EMAIL, env.POCKETBASE_SUPERUSER_PASSWORD);

  for (const id of createdIds.properties) {
    await cleanup.collection("properties").delete(id).catch(() => {});
  }

  for (const id of createdIds.users) {
    await cleanup.collection("users").delete(id).catch(() => {});
  }
}

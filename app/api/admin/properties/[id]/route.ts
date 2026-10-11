import PocketBase from "pocketbase";

import { pocketbaseUrl, serverAdminEmails } from "@/lib/config";

type AdminRouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) return null;

  const response = await fetch(
    `${pocketbaseUrl}/api/collections/users/auth-refresh`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
      method: "POST",
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as { record?: { email?: string } };
  const email = data.record?.email?.toLowerCase() ?? "";

  return serverAdminEmails.includes(email) ? email : null;
}

async function getSuperuserClient() {
  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing PocketBase superuser credentials.");
  }

  const pb = new PocketBase(pocketbaseUrl);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(email, password);

  return pb;
}

export async function PATCH(request: Request, { params }: AdminRouteContext) {
  const admin = await getAuthorizedAdmin(request);

  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as {
    featured?: boolean;
    status?: "published" | "draft" | "sold";
  };
  const payload: Record<string, boolean | string> = {};

  if (typeof body.featured === "boolean") {
    payload.featured = body.featured;
  }

  if (
    body.status === "published" ||
    body.status === "draft" ||
    body.status === "sold"
  ) {
    payload.status = body.status;
  }

  if (Object.keys(payload).length === 0) {
    return Response.json({ error: "No valid changes" }, { status: 400 });
  }

  try {
    const pb = await getSuperuserClient();
    const record = await pb.collection("properties").update(id, payload);

    return Response.json({ id: record.id });
  } catch {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: AdminRouteContext) {
  const admin = await getAuthorizedAdmin(request);

  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const pb = await getSuperuserClient();
    await pb.collection("properties").delete(id);

    return Response.json({ id });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}

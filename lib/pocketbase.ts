"use client";

import PocketBase from "pocketbase";

import { pocketbaseUrl } from "./config";

let client: PocketBase | null = null;

export function getPocketBase() {
  if (!client) {
    client = new PocketBase(pocketbaseUrl);
    client.autoCancellation(false);
  }

  return client;
}

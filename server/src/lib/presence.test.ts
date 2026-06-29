import { test } from "node:test";
import assert from "node:assert/strict";
import { createPresence } from "./presence.ts";

test("connect/disconnect reporta transiciones online/offline", () => {
  const p = createPresence();
  assert.equal(p.connect("a"), true); // offline -> online
  assert.equal(p.isOnline("a"), true);
  assert.equal(p.connect("a"), false); // segunda pestaña, sigue online
  assert.equal(p.disconnect("a"), false); // aún queda una conexión
  assert.equal(p.isOnline("a"), true);
  assert.equal(p.disconnect("a"), true); // última conexión -> offline
  assert.equal(p.isOnline("a"), false);
});

test("onlineAmong filtra solo los conectados", () => {
  const p = createPresence();
  p.connect("a");
  p.connect("c");
  assert.deepEqual(p.onlineAmong(["a", "b", "c"]).sort(), ["a", "c"]);
});

test("disconnect de usuario desconocido no rompe", () => {
  const p = createPresence();
  assert.equal(p.disconnect("ghost"), false);
  assert.equal(p.isOnline("ghost"), false);
});

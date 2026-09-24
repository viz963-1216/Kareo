// C-005: assessment `location` follows API_CONTRACT v0.2.2 §8 for every precision.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLocation, DISTRICTS } from "../src/location/location.ts";

const gps = { lat: 25.0617, lng: 121.4866 };

test("no city → NONE with every field present and null, coordinates dropped", () => {
  for (const coords of [null, gps]) {
    assert.deepEqual(buildLocation({ city: "", district: "", coords }), {
      ok: true,
      location: { precision: "NONE", city: null, district: null, lat: null, lng: null },
    });
  }
});

test("city only → CITY", () => {
  assert.deepEqual(buildLocation({ city: "新北市", district: "", coords: null }), {
    ok: true,
    location: { precision: "CITY", city: "新北市", district: null, lat: null, lng: null },
  });
});

test("city + district → DISTRICT", () => {
  assert.deepEqual(buildLocation({ city: "臺北市", district: "大安區", coords: null }), {
    ok: true,
    location: { precision: "DISTRICT", city: "臺北市", district: "大安區", lat: null, lng: null },
  });
});

test("browser position + city + district → GPS with coordinates", () => {
  assert.deepEqual(buildLocation({ city: "新北市", district: "三重區", coords: gps }), {
    ok: true,
    location: { precision: "GPS", city: "新北市", district: "三重區", lat: gps.lat, lng: gps.lng },
  });
});

test("browser position still needs a district (D-13d)", () => {
  const result = buildLocation({ city: "新北市", district: "", coords: gps });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.field, "district");
});

test("unknown city or a district of another city is rejected, never guessed", () => {
  assert.equal(buildLocation({ city: "臺中市", district: "", coords: null }).ok, false);
  assert.equal(buildLocation({ city: "臺北市", district: "三重區", coords: null }).ok, false);
});

test("out-of-range coordinates are never sent", () => {
  const result = buildLocation({ city: "新北市", district: "三重區", coords: { lat: 200, lng: 0 } });
  assert.deepEqual(result.ok && result.location.precision, "DISTRICT");
});

test("district lists cover 臺北市 12 and 新北市 29 districts without duplicates", () => {
  assert.equal(new Set(DISTRICTS["臺北市"]).size, 12);
  assert.equal(new Set(DISTRICTS["新北市"]).size, 29);
});

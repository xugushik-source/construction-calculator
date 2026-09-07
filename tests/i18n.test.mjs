import test from "node:test";import assert from "node:assert/strict";import {tr} from "../lib/i18n.ts";
test("uses natural contractor terminology",()=>{assert.equal(tr("Estimate","ru"),"Смета");assert.equal(tr("Markup","es"),"Recargo");assert.equal(tr("Profit","ru"),"Прибыль");assert.equal(tr("Client total","es"),"Total cliente")});
test("switches translated labels back to English",()=>{assert.equal(tr("Прибыль","en"),"Profit");assert.equal(tr("Margen objetivo, %","en"),"Target margin %")});

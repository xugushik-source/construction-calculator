import test from "node:test";import assert from "node:assert/strict";import {calculateEstimate} from "../lib/calculation.ts";
test("markup increases cost",()=>{const a=calculateEstimate({items:[{quantity:1,laborRate:50,materialRate:50,markup:.2}]});assert.equal(a.sellingPrice,120);assert.equal(a.profit,20)});
test("target margin uses division",()=>{const a=calculateEstimate({items:[{quantity:1,laborRate:50,materialRate:50,targetMargin:.2}]});assert.equal(a.sellingPrice,125);assert.equal(a.margin,.2)});
test("discount tax and expenses",()=>{const a=calculateEstimate({items:[{quantity:2,laborRate:10,materialRate:20,markup:.5}],additionalExpenses:10,discount:10,tax:.1});assert.equal(a.sellingPrice,99);assert.equal(a.totalCost,70)});
test("negative inputs are clamped",()=>{const a=calculateEstimate({items:[{quantity:-1,laborRate:-10,materialRate:5,markup:-2}]});assert.equal(a.totalCost,0)});

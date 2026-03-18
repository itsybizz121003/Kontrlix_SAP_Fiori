/*global QUnit*/
import Controller from "ashu/ashu/controller/ashui.controller";

QUnit.module("ashui Controller");

QUnit.test("I should test the ashui controller", function (assert: Assert) {
	const oAppController = new Controller("ashui");
	oAppController.onInit();
	assert.ok(oAppController);
});
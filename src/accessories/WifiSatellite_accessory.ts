import {
    Accessory,
    AccessoryEventTypes, Categories,
    Characteristic,
    CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback,
    CharacteristicValue, DataStreamManagement,
    NodeCallback,
    Service,
    uuid,
    VoidCallback
} from '..';
import * as tlv from "../lib/util/tlv";

class wifiControllerClass {

    name = "Querty Snake"; //name of accessory
    pincode: CharacteristicValue = "031-45-154";
    username: CharacteristicValue = "1A:3C:ED:5A:1A:B2"; // MAC like address used by HomeKit to differentiate accessories.
    manufacturer: CharacteristicValue = "HAP-NodeJS2"; //manufacturer (optional)
    model: CharacteristicValue = "v1.0.1"; //model (optional)
    serialNumber: CharacteristicValue = "A12S345KGB2123"; //serial number (optional)

    identify() { //identify the accessory
        console.log("Identify the '%s'", this.name);
    }
}

const wifiController = new wifiControllerClass();

var lightUUID = uuid.generate('hap-nodejs:accessories:routersat2' + wifiController.name);

var wifiAccessory = exports.accessory = new Accessory(wifiController.name as string, lightUUID);

// @ts-ignore
wifiAccessory.username = wifiController.username;
// @ts-ignore
wifiAccessory.pincode = wifiController.pincode;
wifiAccessory.category = Categories.ROUTER;

wifiAccessory
    .getService(Service.AccessoryInformation)!
    .setCharacteristic(Characteristic.Manufacturer, wifiController.manufacturer)
    .setCharacteristic(Characteristic.Model, wifiController.model)
    .setCharacteristic(Characteristic.SerialNumber, wifiController.serialNumber);

wifiAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
    wifiController.identify();
    callback();
});

const satellite = new Service.WifiSatellite("Querty Snake", '');
satellite.setCharacteristic(Characteristic.WifiSatelliteStatus, 1);
wifiAccessory.addService(satellite);

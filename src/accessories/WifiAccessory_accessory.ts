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

export enum WanStatus {
    UNKNOWN = 0x01,
    CABLE_NOT_CONNECTED = 0x02,
    NO_IP_ADDRESS = 0x04,
    NO_GATEWAY = 0x08,
    GATEWAY_NOT_REACHABLE = 0x10,
    NO_DNS_SERVERS_CONFIGURED = 0x20,
    DNS_SERVERS_NOT_REACHABLE = 0x40,
    AUTHENTICATION_FAILURE = 0x80,
    WALLED_NETWORK = 0x100,
}

class wifiControllerClass {

    name = "Querty Snake"; //name of accessory
    pincode: CharacteristicValue = "031-45-153";
    username: CharacteristicValue = "FA:3C:ED:5A:1A:B1"; // MAC like address used by HomeKit to differentiate accessories.
    manufacturer: CharacteristicValue = "HAP-NodeJS"; //manufacturer (optional)
    model: CharacteristicValue = "v1.0"; //model (optional)
    serialNumber: CharacteristicValue = "A12S345KGB"; //serial number (optional)

    managedNetwork = false;

    identify() { //identify the accessory
        console.log("Identify the '%s'", this.name);
    }
}

const wifiController = new wifiControllerClass();

var lightUUID = uuid.generate('hap-nodejs:accessories:router' + wifiController.name);

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

const wifiService = new Service.WiFiRouter(wifiController.name, '');
wifiService.getCharacteristic(Characteristic.RouterStatus)! // read, notify
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, 1);
    }).getValue();

const tlvDefault = Buffer.alloc(3, "000100", "hex").toString("base64");

wifiService.setCharacteristic(Characteristic.NetworkClientControl, tlvDefault); // read, write, notify, timedWrite, writeResponse
wifiService.setCharacteristic(Characteristic.NetworkClientStatusControl, tlvDefault); // read, write, writeResponse
wifiService.setCharacteristic(Characteristic.SupportedRouterConfiguration, tlvDefault); // read
wifiService.setCharacteristic(Characteristic.WANConfigurationList, tlvDefault); // read, notify
wifiService.getCharacteristic(Characteristic.WANStatusList)!
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        // 0x01: identifier
        // 0x02: status

        const buffer = tlv.encode(0x01, tlv.writeUInt32(61278293),
            0x02, tlv.writeUInt64(WanStatus.WALLED_NETWORK));
        const tlvStatusList = tlv.encode(0x01, buffer);
        callback(undefined, tlvStatusList.toString("base64"));
    }).getValue(); // read, notify
wifiService.getCharacteristic(Characteristic.ManagedNetworkEnable)! // read, write, notify, timedWrite
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, wifiController.managedNetwork);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        console.log("Received set request for ManagedNetworkEnable: '" + value +"'");
        wifiController.managedNetwork = value as boolean;
        callback(undefined); // write response
    });

wifiService.getCharacteristic(Characteristic.NetworkClientControl)!
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        console.log("Received set request for NetworkClientControl: '" + value +"'");
        callback(undefined, tlvDefault); // write response
    });

wifiService.getCharacteristic(Characteristic.NetworkClientStatusControl)!
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        console.log("Received set request for NetworkClientStatusControl: '" + value +"'");
        callback(undefined, tlvDefault); // write response
    });

wifiAccessory.addService(wifiService);
wifiAccessory.setPrimaryService(wifiService);

const dataStream = new DataStreamManagement();

wifiAccessory.addService(dataStream.getService());
wifiService.addLinkedService(dataStream.getService());

// on connect subscribing to: RouterStatus, WANStatusList

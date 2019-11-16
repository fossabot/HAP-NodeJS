import {
    Accessory,
    AccessoryEventTypes,
    Categories,
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    DataStreamManagement,
    Service,
    uuid,
    VoidCallback,
} from '..';
import * as tlv from "../lib/util/tlv";

export enum AccessViolationControlOperation {
    LIST = 0x01,
    RESET = 0x02,
}

export enum RouterAdvertisementProtocol {
    DNSSD = 0x00,
    SSDP = 0x01,
}

export enum ClientStatusControlOperation {
    READ = 0x01,
}

export enum ControlOperationStatus {
    SUCCESS = 0x00,
    UNKNOWN = 0x01,
    NOT_ALLOWED = 0x02,
    OUT_OF_RESOURCES = 0x03,
    BULK_OPERATION_FAILED = 0x04,
    INVALID_PARAMETERS = 0x05,
    INVALID_IDENTIFIER = 0x06,
    INVALID_CREDENTIAL = 0x07,
    CREDENTIAL_EXISTS = 0x08,
    INVALID_HOST = 0x09,
    INVALID_PORT = 0x0a,
    INVALID_SERVICE_TYPE = 0x0b,
}

export enum ControlOperation {
    LIST = 0x01,
    READ = 0x02,
    ADD = 0x03,
    REMOVE = 0x04,
    UPDATE = 0x05,
}

export enum IPProtocolVersion {
    IPV4 = 0x00,
    IPV6 = 0x01,
}

export enum LANFirewall {
    FULL_ACCESS = 0x00,
    ALLOW_LIST_ACCESS = 0x01,
}

export enum LANIdentifier {
    MAIN = 0x01,
    HOMEKIT = 0x03,
}

export enum Protocol {
    TCP = 0x00,
    UDP = 0x01,
}

export enum RuleDirection {
    OUTBOUND = 0x00,
    INBOUND = 0x01,
}

export enum WANFirewall {
    FULL_ACCESS = 0x00,
    ALLOW_LIST_ACCESS = 0x01,
}

export enum WANIdentifier {
    MAIN = 0x01,
}

export enum WANStatus {
    UNKNOWN = 0x01,
    CABLE_NOT_CONNECTED = 0x02,
    NO_IP_ADDRESS = 0x04,
    NO_GATEWAY = 0x08,
    GATEWAY_NOT_REACHABLE = 0x010,
    NO_DNS_SERVERS_CONFIGURED = 0x20,
    DNS_SERVERS_NOT_REACHABLE = 0x040,
    AUTHENTICATION_FAILURE = 0x80,
    WALLED_NETWORK = 0x100,
}

// ----------- WANStatusList
export enum WANStatusListTypes {
    STATUS = 0x01, // list
}

export enum WANStatusTypes {
    IDENTIFIER = 0x01,
    STATUS = 0x02,
}

// ------------ ClientStatusControl
export enum ClientStatusControlTypes {
    OPERATION = 0x01,
    STATUS_IDENTIFIER_LIST = 0x02,
}

export enum ClientStatusIdentifierListTypes {
    STATUS_IDENTIFIER = 0x01,
}

export enum ClientStatusIdentifierTypes {
    CLIENT_IDENTIFIER = 0x01,
    MAC_ADDRESS = 0x02,
    IP_ADDRESS = 0x03,
}

export enum IPAddressTypes {
    IPV4 = 0x01,
    IPV6 = 0x02,
}

class wifiControllerClass {

    name = "Querty Snake"; //name of accessory
    pincode: CharacteristicValue = "031-45-153";
    username: string = "FA:3C:ED:5A:1A:B1"; // MAC like address used by HomeKit to differentiate accessories.
    manufacturer: CharacteristicValue = "HAP-NodeJS"; //manufacturer (optional)
    model: CharacteristicValue = "v1.0"; //model (optional)
    serialNumber: CharacteristicValue = "A12S345KGB"; //serial number (optional)

    identify() { //identify the accessory
        console.log("Identify the '%s'", this.name);
    }
}

const wifiController = new wifiControllerClass();

var lightUUID = uuid.generate('hap-nodejs:accessories:wifi-router' + wifiController.name);

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
        const statusList = tlv.encode(
            WANStatusListTypes.STATUS, tlv.encode(
                WANStatusTypes.IDENTIFIER, macToInt(wifiController.username),
                WANStatusTypes.STATUS, tlv.writeUInt32(WANStatus.WALLED_NETWORK),
            ),
        );

        callback(undefined, statusList.toString("base64"));
    }).getValue(); // read, notify

let managedNetwork = false;
wifiService.getCharacteristic(Characteristic.ManagedNetworkEnable)! // read, write, notify, timedWrite
    .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, managedNetwork);
    })
    .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        console.log("Received set request for ManagedNetworkEnable: '" + value +"'");
        managedNetwork = value as boolean;
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
function macToInt(macAddress: string) {
    return Buffer.alloc(8, "0000" + macAddress.replace(":", ""), "hex");
}

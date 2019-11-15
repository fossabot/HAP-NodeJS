import {
  Accessory,
  AccessoryEventTypes,
  Categories,
  Characteristic,
  Service,
  uuid,
  VoidCallback,
} from '..';

const UUID = uuid.generate('hap-nodejs:accessories:wifi-router');
export const accessory = new Accessory('Wi-Fi Router', UUID);

// @ts-ignore
accessory.username = 'FA:3C:ED:D2:1A:A2';
// @ts-ignore
accessory.pincode = '031-45-154';
// @ts-ignore
accessory.category = Categories.ROUTER;

accessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  console.log("Identify the '%s'", accessory.displayName);
  callback();
});

const router = accessory.addService(Service.WiFiRouter);

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

export enum LANIdentifier {
  MAIN = 0x01,
  HOMEKIT = 0x03,
}

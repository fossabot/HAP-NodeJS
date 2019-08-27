// manually created

import {Characteristic, Formats, Perms} from '../Characteristic';


/**
 * Characteristic "Supported Data Stream Transport Configuration"
 */

export class SupportedDataStreamTransportConfiguration extends Characteristic {

    static readonly UUID: string = '00000130-0000-1000-8000-0026BB765291';

    constructor() {
        super('Supported Data Stream Transport Configuration', SupportedDataStreamTransportConfiguration.UUID);
        this.setProps({
            format: Formats.TLV8,
            perms: [Perms.PAIRED_READ]
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.SupportedDataStreamTransportConfiguration = SupportedDataStreamTransportConfiguration;

/**
 * Characteristic "Setup Data Stream Transport"
 */

export class SetupDataStreamTransport extends Characteristic {

    static readonly UUID: string = '00000131-0000-1000-8000-0026BB765291';

    constructor() {
        super('Setup Data Stream Transport', SetupDataStreamTransport.UUID);
        this.setProps({
            format: Formats.TLV8,
            perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.WRITE_RESPONSE]
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.SetupDataStreamTransport = SetupDataStreamTransport;

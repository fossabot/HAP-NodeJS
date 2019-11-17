import {ChildProcessWithoutNullStreams, spawn} from "child_process";
import fs from "fs";
import crypto from "crypto";
import ip from "ip";
import * as tlv from "../lib/util/tlv";
import {
    Accessory,
    Categories,
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue, DataStreamConnection,
    DataStreamManagement, DataStreamServerEvents,
    NodeCallback, Protocols,
    Service,
    SessionIdentifier,
    SnapshotRequest,
    StreamAudioParams,
    StreamVideoParams, Topics,
    uuid
} from "..";
import {
    PreparedStreamRequestCallback,
    PreparedStreamResponse,
    PrepareStreamRequest,
    SRTPCryptoSuites,
    StreamController,
    StreamControllerOptions,
    StreamRequest
} from "./StreamController";

const sharp = require("sharp");

const cameraUUID = uuid.generate('hap-nodejs:accessories:ip-camera');
const camera = exports.accessory = new Accessory('TestCamera', cameraUUID);

// @ts-ignore
camera.username = "44:53:39:4E:BB:91";
// @ts-ignore
camera.pincode = "269-41-854";
camera.category = Categories.IP_CAMERA;

setTimeout(() => {
    const cameraSource = new IPCameraExample();
    // @ts-ignore
    camera.configureCameraSource(cameraSource);
},0);

const H264Profile = [
    "baseline",
    "main",
    "high444"
];
const H264Level = [
    "3.1",
    "3.2",
    "4.0"
];

export type SessionInfo = {
    address: string;
    audio_port: number;
    audio_crypto_suite: SRTPCryptoSuites,
    audio_srtp: Buffer;
    audio_ssrc: number;
    video_port: number;
    video_crypto_suite: SRTPCryptoSuites,
    video_srtp: Buffer;
    video_ssrc: number;
}

export enum SourceState {
    UNUSED,
    USED_VIDEO_STREAM,
    USED_SNAPSHOT,
}

export type SnapshotBuffer = {
    time: number,
    buffer: Buffer,
    width: number,
    height: number,
}


//--------------- SupportedVideoRecordingConfiguration
export enum SupportedVideoRecordingConfigurationTypes {
    CODEC_CONFIGURATION = 0x01, // list
}

export enum VideoCodecConfigurationTypes {
    CODEC = 0x01, // number
    PARAMETERS = 0x02,
    ATTRIBUTES = 0x03, // list
}

export enum VideoCodecParametersTypes {
    PROFILE_ID = 0x01, // list
    LEVEL = 0x02, // list
    BITRATE = 0x03,
    IFRAME_INTERVAL = 0x04,
}

export enum VideoCodecAttributesTypes {
    IMAGE_WIDTH = 0x01,
    IMAGE_HEIGHT = 0x02,
    FRAME_RATE = 0x03,
}

export enum RecordingVideoCodec {
    H264 = 0x00,
    H265 = 0x01,
}

export enum RecordingVideoH264Profile {
    BASE = 0x00,
    MAIN = 0x01,
    HIGH = 0x02,
}

export enum RecordingVideoH264Level {
    LEVEL_3_1 = 0x00,
    LEVEL_3_2 = 0x01,
    LEVEL_4 = 0x02,
}

//--------------- SupportedAudioRecordingConfiguration

export enum SupportedAudioRecordingConfigurationTypes {
    CODEC_CONFIGURATION = 0x01, // list
}

export enum AudioCodecConfigurationTypes {
    RECORDING_CODEC = 0x01,
    PARAMETERS = 0x02
}

export enum AudioCodecParametersTypes {
    CHANNELS = 0x01, // number
    BIT_RATE_MODES = 0x02, // list
    SAMPLE_RATES = 0x03, // list
    MAX_AUDIO_BITRATE = 0x04 // number
}

export enum RecordingAudioCodec {
    AAC_LC = 0x00,
    AAC_ELD = 0x01,
}

export enum RecordingAudioBitrateMode {
    VARIABLE = 0x00,
    CONSTANT = 0x01,
}

export enum RecordingSampleRate {
    KHZ_8 = 0x00,
    KHZ_16 = 0x01,
    KHZ_24 = 0x02,
    KHZ_32 = 0x03,
    KHZ_44_1 = 0x04,
    KHZ_48 = 0x05,
}

// ---- GeneralConfiguration
export enum RecordingGeneralConfigurationTypes {
    PRE_BUFFER_LENGTH = 0x01,
    EVENT_TRIGGER_OPTIONS = 0x02,
    MEDIA_CONTAINER_CONFIGURATIONS = 0x03, // list
}

export enum MediaContainerConfigurationTypes {
    MEDIA_CONTAINER_TYPE = 0x01, // number
    CONTAINER_PARAMETERS = 0x02,
}

export enum MediaContainerParametersTypes {
    FRAGMENT_LENGTH = 0x01, // number
}

export enum EventTriggerOption { // bitmask
    MOTION = 0x01,
    DOORBELL = 0x02,
}

export enum MediaContainerType {
    FRAGMENTED_MP4 = 0x00,
}

//--------------- SelectedConfiguration
export enum SelectedConfigurationTypes {
    GENERAL_CONFIGURATION = 0x01,
    VIDEO_CONFIGURATION = 0x02,
    AUDIO_CONFIGURATION = 0x03,
}

// other enums, don't know if we need them?
export enum RecordingVideoResolution { // preferred video resolution
    UNKNOWN = 0x00,
    R_640x480 = 0x01,
    R_1024x768 = 0x02,
    R_1280x960 = 0x03,
    R_2048x1536 = 0x04,
    R_640x360 = 0x05,
    R_1280x720 = 0x06,
    R_1920x1080 = 0x07,
    R_3840x2160 = 0x08,
}

export class IPCameraExample {

    private static readonly filename = __dirname + "/snapshot.jpg";

    services: Service[] = [];
    streamControllers: StreamController[] = [];
    pendingSessions: Record<string, SessionInfo> = {};
    ongoingSessions: Record<string, ChildProcessWithoutNullStreams> = {};

    sourceState: SourceState = SourceState.UNUSED;
    lastSnapshot: SnapshotBuffer = {
        time: 0,
        width: 0,
        height: 0,
        buffer: Buffer.alloc(0)
    };

    recordingSupportedConfiguration: string;
    recordingSupportedVideoConfiguration: string;
    recordingSupportedAudioConfiguration: string;
    selectedConfiguration: string;

    options: StreamControllerOptions;

    dataStreamConnection?: DataStreamConnection;

    constructor() {
        const options: StreamControllerOptions = {
            proxy: false, // Requires RTP/RTCP MUX Proxy
            disable_audio_proxy: false, // If proxy = true, you can opt out audio proxy via this
            supportedCryptoSuites: [
                SRTPCryptoSuites.NONE,
                SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80
            ],
            video: {
                resolutions: [
                    //[1920, 1080, 30], // Width, Height, framerate
                    [320, 240, 15], // Apple Watch requires this configuration
                    [1280, 960, 30],
                    [1280, 720, 30],
                    [1024, 768, 30],
                    [640, 480, 30],
                    [640, 360, 30],
                    [480, 360, 30],
                    [480, 270, 30],
                    [320, 240, 30],
                    [320, 180, 30],
                ],
                codec: {
                    profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
                    levels: [0, 1, 2] // Enum, please refer StreamController.VideoCodecParamLevelTypes
                }
            },
            audio: {
                comfort_noise: false,
                codecs: [
                    {
                        type: "OPUS", // Audio Codec
                        samplerate: 24 // 8, 16, 24 KHz
                    },
                    {
                        type: "AAC-eld",
                        samplerate: 16
                    }
                ]
            }
        };
        this.options = options;

        this.recordingSupportedConfiguration = this._supportedRecordingGeneralConfiguration();
        this.recordingSupportedVideoConfiguration = this._supportedRecordingVideoStreamConfiguration();
        this.recordingSupportedAudioConfiguration = this._supportedRecordingAudioStreamConfiguration();
        this.selectedConfiguration = "";

        //this.createCameraControlService();
        this.createSecureVideoService();
        this._createStreamControllers(2, options);
    }

    createSecureVideoService = () => {
        const motionSensor = new Service.MotionSensor('', '');
        this.services.push(motionSensor);

        const switchService = new Service.Switch('', '');

        switchService.getCharacteristic(Characteristic.On)!
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                if (value == true) {
                    motionSensor.setCharacteristic(Characteristic.MotionDetected, true);

                    /*
                    this.dataStreamConnection!.sendRequest(Protocols.DATA_SEND, Topics.OPEN, {
                        target: "controller",
                        type: "ipcamera.recording",
                    }, (error, status, message) => {
                        if (error || status) {
                            if (error) { // errors get produced by hap-nodejs
                                console.log("Error occurred trying to start siri audio stream: " + error.message);
                            } else if (status) { // status codes are those returned by the hds response
                                console.log("Controller responded with non-zero status code: " + status);
                            }
                        } else {
                            console.log("Received message: " + message);
                        }
                    });*/

                    setTimeout(() => {
                        motionSensor.setCharacteristic(Characteristic.MotionDetected, false);
                        switchService.getCharacteristic(Characteristic.On)!.updateValue(false);
                    }, 1500);
                }

                callback();
            });
        this.services.push(switchService);

        const operationMode = new Service.CameraOperatingMode('Motion detect', 'motion');

        let eventActive = false;
        let homekitCameraActive = false;
        let periodicSnapshotActive = false;
        let operationModeIndicator = false;
        let nightVision = false;
        let thirdPartyCameraActive = false;

        operationMode.getCharacteristic(Characteristic.EventSnapshotsActive)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, eventActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                eventActive = value as boolean;
                callback();
            });
        operationMode.getCharacteristic(Characteristic.HomeKitCameraActive)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, homekitCameraActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                homekitCameraActive = value as boolean;
                callback();
            });
        operationMode.getCharacteristic(Characteristic.PeriodicSnapshotsActive)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, periodicSnapshotActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                periodicSnapshotActive = value as boolean;
                callback();
            });
        operationMode.getCharacteristic(Characteristic.CameraOperatingModeIndicator)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, operationModeIndicator);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                operationModeIndicator = value as boolean;
                callback();
            });
        operationMode.getCharacteristic(Characteristic.NightVision)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, nightVision);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                nightVision = value as boolean;
                callback();
            });
        operationMode.getCharacteristic(Characteristic.ThirdPartyCameraActive)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, thirdPartyCameraActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                thirdPartyCameraActive = value as boolean;
                callback();
            });

        const manuallyDisabled = new Service.Switch('Manual disable', 'manually disabled');

        manuallyDisabled.getCharacteristic(Characteristic.On)!
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                if (value == true) {
                    operationMode.setCharacteristic(Characteristic.ManuallyDisabled, true);
                } else {
                    operationMode.setCharacteristic(Characteristic.ManuallyDisabled, false);
                }

                callback();
            });
        this.services.push(manuallyDisabled);


        this.services.push(operationMode);

        const recordingManagement = new Service.CameraRecordingManagement('', '');

        let recordingActive = false;
        let recordingAudioActive = false;

        const tlvDefault = Buffer.alloc(3,"000100", "hex").toString("base64");

        recordingManagement.getCharacteristic(Characteristic.Active)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, recordingActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                recordingActive = value as boolean;
                console.log("Recording was set to " + (value? "ACTIVE": "INACTIVE"));
                callback();
            });
        recordingManagement.getCharacteristic(Characteristic.RecordingAudioActive)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, recordingAudioActive);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                recordingAudioActive = value as boolean;
                console.log("Recording audio was set to " + (value? "ACTIVE": "INACTIVE"));
                callback();
            });
        recordingManagement.getCharacteristic(Characteristic.SupportedCameraRecordingConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
            callback(undefined, this.recordingSupportedConfiguration);
            }).getValue();
        recordingManagement.getCharacteristic(Characteristic.SupportedVideoRecordingConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.recordingSupportedVideoConfiguration);
            }).getValue();
        recordingManagement.getCharacteristic(Characteristic.SupportedAudioRecordingConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.recordingSupportedAudioConfiguration);
            }).getValue();
        recordingManagement.getCharacteristic(Characteristic.SelectedCameraRecordingConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.selectedConfiguration);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.selectedConfiguration = value as string;
                this.handleSelectedCameraRecordingConfigurationWrite(this.selectedConfiguration);
                callback();
            }).getValue();

        this.services.push(recordingManagement);

        const datastreamManagement = new DataStreamManagement();
        this.services.push(datastreamManagement.getService());
        recordingManagement.addLinkedService(datastreamManagement.getService());
        recordingManagement.addLinkedService(motionSensor);

        datastreamManagement.onServerEvent(DataStreamServerEvents.CONNECTION_OPENED, connection => {
            this.dataStreamConnection = connection;
        });
    };

    _supportedRecordingGeneralConfiguration() {
        let mediaContainerConfigurationsList: Buffer;

        // noinspection LoopStatementThatDoesntLoopJS
        for (;;) { // TODO remove
            const parametersTlv = tlv.encode(
                MediaContainerParametersTypes.FRAGMENT_LENGTH, tlv.writeUInt32(4000),
            );

            const containerTlv = tlv.encode(
                MediaContainerConfigurationTypes.MEDIA_CONTAINER_TYPE, MediaContainerType.FRAGMENTED_MP4,
                MediaContainerConfigurationTypes.CONTAINER_PARAMETERS, parametersTlv,
            );

            mediaContainerConfigurationsList = tlv.encode(
                RecordingGeneralConfigurationTypes.MEDIA_CONTAINER_CONFIGURATIONS, containerTlv,
            );

            break;
        }

        return Buffer.concat([
            tlv.encode(
                RecordingGeneralConfigurationTypes.PRE_BUFFER_LENGTH, tlv.writeUInt32(8000),
                //RecordingGeneralConfigurationTypes.EVENT_TRIGGER_OPTIONS, EventTriggerOption.MOTION, // TODO
                RecordingGeneralConfigurationTypes.EVENT_TRIGGER_OPTIONS, Buffer.from("0100000000000000", "hex"),
            ),
            mediaContainerConfigurationsList,
        ]).toString("base64");
    }

    _supportedRecordingVideoStreamConfiguration = () => {
        let parametersTlv = tlv.encode(
            VideoCodecParametersTypes.PROFILE_ID, RecordingVideoH264Profile.MAIN,
            VideoCodecParametersTypes.PROFILE_ID, RecordingVideoH264Profile.BASE,
            VideoCodecParametersTypes.PROFILE_ID, RecordingVideoH264Profile.HIGH,
            VideoCodecParametersTypes.LEVEL, RecordingVideoH264Level.LEVEL_3_1,
            VideoCodecParametersTypes.LEVEL, RecordingVideoH264Level.LEVEL_3_2,
            VideoCodecParametersTypes.LEVEL, RecordingVideoH264Level.LEVEL_4,
            // VideoCodecParametersTypes.BITRATE, 0
            // VideoCodecParametersTypes.IFRAME_INTERVAL, 0
        );

        const resolutionsList =  [
            [1920, 1080, 30], // Width, Height, framerate
            [1280, 720, 30],
            [640, 360, 30],
            [1920, 1080, 15],
            [1280, 720, 15],
            [640, 360, 15],
        ];
        let attributesTlv = Buffer.alloc(0);
        resolutionsList.forEach(value => {
            if (value.length != 3) {
                throw new Error('Unexpected video resolution');
            }

            const width = value[0];
            const height = value[1];
            const frameRate = value[2];

            const videoAttributeTlv = tlv.encode(
                VideoCodecAttributesTypes.IMAGE_WIDTH, width,
                VideoCodecAttributesTypes.IMAGE_HEIGHT, height,
                VideoCodecAttributesTypes.FRAME_RATE, frameRate,
            );

            attributesTlv = Buffer.concat([attributesTlv,
                tlv.encode(VideoCodecConfigurationTypes.ATTRIBUTES, videoAttributeTlv)
            ]);
        });

        const videoCodecConfiguration = Buffer.concat([
            tlv.encode(
                VideoCodecConfigurationTypes.CODEC, RecordingVideoCodec.H264, // h264
                VideoCodecConfigurationTypes.PARAMETERS, parametersTlv,
            ),
            attributesTlv
        ]);

        // one tlv per supported codec
        return tlv.encode(SupportedVideoRecordingConfigurationTypes.CODEC_CONFIGURATION, videoCodecConfiguration).toString("base64");
    };

    _supportedRecordingAudioStreamConfiguration = () => {
        let audioConfigurationsList = Buffer.alloc(0);

        // noinspection LoopStatementThatDoesntLoopJS
        for (;;) { // can be list
            const parametersTlv = tlv.encode(
                AudioCodecParametersTypes.CHANNELS, 1,
                AudioCodecParametersTypes.BIT_RATE_MODES, RecordingAudioBitrateMode.VARIABLE,
                AudioCodecParametersTypes.SAMPLE_RATES, RecordingSampleRate.KHZ_32, // can be list
                //AudioCodecParametersTypes.MAX_AUDIO_BITRATE, 48, // TODO value
            );

            const audioConfigurationTlv = tlv.encode(
                AudioCodecConfigurationTypes.RECORDING_CODEC, RecordingAudioCodec.AAC_LC,
                AudioCodecConfigurationTypes.PARAMETERS, parametersTlv,
            );

            audioConfigurationsList = Buffer.concat([audioConfigurationsList,
                tlv.encode(SupportedAudioRecordingConfigurationTypes.CODEC_CONFIGURATION, audioConfigurationTlv),
            ]);
            break;
        }

        return audioConfigurationsList.toString("base64");
    };

    handleSelectedCameraRecordingConfigurationWrite(tlvString: string) {
        const tlvData = Buffer.from(tlvString, "base64");
        const objects = tlv.decode(tlvData);

        const generalConfigurationTlv = objects[SelectedConfigurationTypes.GENERAL_CONFIGURATION];
        const generalObjects = tlv.decode(generalConfigurationTlv);

        const prebufferLength = tlv.readUInt32(generalObjects[RecordingGeneralConfigurationTypes.PRE_BUFFER_LENGTH]);
        const eventTriggerOptions = tlv.readUInt64(generalObjects[RecordingGeneralConfigurationTypes.EVENT_TRIGGER_OPTIONS]);
        const containerObjects = tlv.decode(generalObjects[RecordingGeneralConfigurationTypes.MEDIA_CONTAINER_CONFIGURATIONS]);

        const containerType = containerObjects[MediaContainerConfigurationTypes.MEDIA_CONTAINER_TYPE][0];
        const paramsObjects = tlv.decode(containerObjects[MediaContainerConfigurationTypes.CONTAINER_PARAMETERS]);
        const fragmentLength = tlv.readUInt32(paramsObjects[MediaContainerParametersTypes.FRAGMENT_LENGTH]);

        const generalConfiguration = {
            preBufferLength: prebufferLength,
            eventTriggerOptions: eventTriggerOptions,
            containerConfiguration: {
                containerType: containerType,
                parameters: {
                    fragmentLenght: fragmentLength,
                }
            }
        };

        const videoConfigurationTlv = objects[SelectedConfigurationTypes.VIDEO_CONFIGURATION];
        const videoObjects = tlv.decode(videoConfigurationTlv);

        const videoCodec = videoObjects[VideoCodecConfigurationTypes.CODEC];
        const videoParameters = tlv.decode(objects[VideoCodecConfigurationTypes.PARAMETERS]);
        const videoAttributes = tlv.decode(objects[VideoCodecConfigurationTypes.ATTRIBUTES]);

        const videoProfile = videoParameters[VideoCodecParametersTypes.PROFILE_ID];
        const videoLevel = videoParameters[VideoCodecParametersTypes.LEVEL];
        const videoBitrate = videoParameters[VideoCodecParametersTypes.BITRATE];
        const iFrameInterval = videoParameters[VideoCodecParametersTypes.IFRAME_INTERVAL];

        const width = videoAttributes[VideoCodecAttributesTypes.IMAGE_WIDTH];
        const height = videoAttributes[VideoCodecAttributesTypes.IMAGE_HEIGHT];
        const framerate = videoAttributes[VideoCodecAttributesTypes.FRAME_RATE];

        const videoConfiguration = {
            codec: videoCodec,
            parameters: {
                profile: videoProfile,
                level: videoLevel,
                bitrate: videoBitrate,
                iFrameInterval: iFrameInterval,
            },
            attributes: {
                width: width,
                height: height,
                framerate: framerate,
            }
        };

        const audioConfigurationTlv = objects[SelectedConfigurationTypes.AUDIO_CONFIGURATION];
        const audioObjects = tlv.decode(audioConfigurationTlv);

        const audioCodec = audioObjects[AudioCodecConfigurationTypes.RECORDING_CODEC];
        const audioParameters = tlv.decode(objects[AudioCodecConfigurationTypes.PARAMETERS]);

        const channels = audioParameters[AudioCodecParametersTypes.CHANNELS];
        const bitrateModes = audioParameters[AudioCodecParametersTypes.BIT_RATE_MODES];
        const sampleRate = audioParameters[AudioCodecParametersTypes.SAMPLE_RATES];
        const maxAudioBitRate = audioParameters[AudioCodecParametersTypes.MAX_AUDIO_BITRATE];

        const audioConfiguration = {
            codec: audioCodec,
            parameters: {
                channels: channels,
                bitrateModes: bitrateModes,
                samplerate: sampleRate,
                maxAudioBitRate: maxAudioBitRate,
            }
        };

        const selectedConfiguration = {
            generalConfiguration: generalConfiguration,
            videoConfiguration: videoConfiguration,
            audioConfiguration: audioConfiguration,
        };

        console.log("Received selected configuration:");
        console.log(JSON.stringify(selectedConfiguration, null, 4));
    }

    handleSnapshotRequest = (request: SnapshotRequest, callback: NodeCallback<Buffer>) => {
        if (new Date().getTime() - this.lastSnapshot.time <= 5000  // if last snapshot was captured in less 5s ago
            && this.lastSnapshot.width === request.width && this.lastSnapshot.height === request.height) { // and same aspect ratio
            console.log("Used snapshot buffer!");
            callback(null, this.lastSnapshot.buffer);
        } else {
            switch (this.sourceState) {
                case SourceState.UNUSED:
                    this.captureSnapshot(request.width, request.height, callback);
                    break;
                case SourceState.USED_VIDEO_STREAM:
                    this.readSnapshotFromFS(request.width, request.height, callback);
                    break;
                case SourceState.USED_SNAPSHOT:
                    setTimeout(() => {
                        this.handleSnapshotRequest(request, callback);
                    }, 50);
                    break;
            }
        }
    };

    readSnapshotFromFS(width: number, height: number, callback: NodeCallback<Buffer>) {
        if (!fs.existsSync(IPCameraExample.filename)) {
            console.log("Snapshot file does not exist!");
            callback(new Error("Snapshot file does not exist!"));
            return;
        }

        sharp(IPCameraExample.filename)
            .resize(width, height)
            .toBuffer((error: any, data: any) => {
                if (error) {
                    console.log("Error reading and resizing snapshot from filesystem");
                    console.log(error);
                    callback(error);
                }
                else {
                    console.log("Returning snapshot from FS!");
                    callback(null, data);
                }
            });
    }


    captureSnapshot(width: number, height: number, callback: NodeCallback<Buffer>) {
        this.sourceState = SourceState.USED_SNAPSHOT;

        const ffmpegCommand = `-f lavfi -i testsrc=s=${width}x${height} -vframes 1 -f mjpeg -`;
        const ffmpeg = spawn("ffmpeg", ffmpegCommand.split(" "), {env: process.env});

        let snapshotBuffer = Buffer.alloc(0);
        ffmpeg.stdout.on('data', data => {
            snapshotBuffer = Buffer.concat([snapshotBuffer, data]);
        });

        // noinspection JSUnusedLocalSymbols
        ffmpeg.stderr.on('data', data => {
            //console.log('ffmpeg-snap-stderr ' + String(data));
        });

        ffmpeg.on('exit', (code, signal) => {
            this.sourceState = SourceState.UNUSED;

            if (signal) {
                console.log("Snapshot process was killed with signal: " + signal);
                callback(new Error("killed with signal " + signal));
            }
            else if (code === 0) {
                console.log(`Successfully captured snapshot at ${width}x${height}`);

                this.lastSnapshot = {
                    time: new Date().getTime(),
                    buffer: snapshotBuffer,
                    width: width,
                    height: height
                };
                callback(null, snapshotBuffer);
            }
            else {
                console.log("Snapshot process exited with code " + code);
                callback(new Error("Snapshot process exited with code " + code));
            }
        });
    }

    handleCloseConnection = (connectionID: string) => {
        this.streamControllers.forEach(function(controller) {
            controller.handleCloseConnection(connectionID);
        });
    };

    prepareStream = (request: PrepareStreamRequest, callback: PreparedStreamRequestCallback) => {
        const sessionInfo: Partial<SessionInfo> = {
            address: request.targetAddress
        };

        const sessionID: SessionIdentifier = request.sessionID;
        const sessionIdentifier = uuid.unparse(sessionID);

        const response: Partial<PreparedStreamResponse> = {};

        const videoInfo = request.video;
        if (videoInfo) {
            let targetPort = videoInfo.port;
            let srtp_key = videoInfo.srtp_key;
            let srtp_salt = videoInfo.srtp_salt;

            // SSRC is a 32 bit integer that is unique per stream
            let ssrcSource = crypto.randomBytes(4);
            ssrcSource[0] = 0;
            let ssrc = ssrcSource.readInt32BE(0);

            response.video = {
                port: targetPort,
                ssrc: ssrc,
                cryptoSuite: videoInfo.cryptoSuite,
                srtp_key: srtp_key,
                srtp_salt: srtp_salt
            };

            sessionInfo.video_port = targetPort;
            sessionInfo.video_crypto_suite = videoInfo.cryptoSuite;
            sessionInfo.video_srtp = Buffer.concat([srtp_key, srtp_salt]); // empty buffer if crypto is NONE
            sessionInfo.video_ssrc = ssrc;
        }

        const audioInfo = request.audio;
        if (audioInfo) {
            let targetPort = audioInfo.port;
            let srtp_key = audioInfo.srtp_key;
            let srtp_salt = audioInfo.srtp_salt;

            // SSRC is a 32 bit integer that is unique per stream
            let ssrcSource = crypto.randomBytes(4);
            ssrcSource[0] = 0;
            let ssrc = ssrcSource.readInt32BE(0);

            response.audio = {
                port: targetPort,
                ssrc: ssrc,
                cryptoSuite: audioInfo.cryptoSuite,
                srtp_key: srtp_key,
                srtp_salt: srtp_salt
            };

            sessionInfo.audio_port = targetPort;
            sessionInfo.audio_crypto_suite = audioInfo.cryptoSuite;
            sessionInfo.audio_srtp = Buffer.concat([srtp_key, srtp_salt]); // empty buffer if crypto is NONE
            sessionInfo.audio_ssrc = ssrc;
        }

        const currentAddress = ip.address();
        response.address = {
            address: currentAddress,
            type: ip.isV4Format(currentAddress) ? "v4" : "v6"
        };

        this.pendingSessions[sessionIdentifier] = sessionInfo as SessionInfo;

        callback(response as PreparedStreamResponse);
    };

    handleStreamRequest = (request: StreamRequest) => {
        const sessionID = request['sessionID'];
        const requestType = request['type'];
        if (!sessionID)
            return;

        const sessionIdentifier = uuid.unparse(sessionID, 0);

        switch (requestType) {
            case "start":
                this.startStream(sessionID, sessionIdentifier, request);
                break;
            case "reconfigure":
                this.reconfigureStream(sessionIdentifier, request);
                break;
            case "stop":
                this.stopStream(sessionIdentifier);
                break;
            default:
                console.log("Got unknown request type: " + requestType);
        }
    };

    startStream(sessionID: SessionIdentifier, sessionIdentifier: string, request: StreamRequest) {
        if (!this.pendingSessions[sessionIdentifier]) {
            console.log(`Got start stream request but sessionIdentifier (${sessionIdentifier}) could not be found in pendingSessions`);
            return;
        }

        if (this.sourceState === SourceState.USED_SNAPSHOT) {
            setTimeout(() => {
                this.startStream(sessionID, sessionIdentifier, request);
            }, 50);
            return;
        } else if (this.sourceState === SourceState.USED_VIDEO_STREAM) {
            return;
        }


        let width = 1280;
        let height = 720;
        let fps = 30;
        let videoBitrate = 300;

        let profile = 2; // corresponds to high
        let level = 2; // corresponds to 4.0
        let videoPayloadType = 99;
        let maximalTransmissionUnit = 1378; // 188 1316

        if (request.video) {
            width = request.video['width'];
            height = request.video['height'];
            fps = Math.min(fps, request.video['fps']); // TODO define max fps
            videoBitrate = request.video['max_bit_rate'];

            profile = request.video['profile'];
            level = request.video['level'];
            videoPayloadType = request.video['pt'];
            maximalTransmissionUnit = request.video['mtu'] || 1378; // 1378 is the requested default from the hap spec
        }

        const address = this.pendingSessions[sessionIdentifier].address;

        const videoPort = this.pendingSessions[sessionIdentifier].video_port;
        const videoCrypto = this.pendingSessions[sessionIdentifier].video_crypto_suite;
        const videoSrtp = this.pendingSessions[sessionIdentifier].video_srtp.toString('base64');
        const videoSsrc = this.pendingSessions[sessionIdentifier].video_ssrc;

        console.log(`Starting video stream (${width}x${height}, ${fps} fps, ${videoBitrate} kbps, ${maximalTransmissionUnit} mtu)...`);
        let videoffmpegCommand = `\
-f lavfi -re -i testsrc=size=${width}x${height}:rate=${fps} -map 0:0 \
-c:v libx264 -an -sn -dn -b:v ${videoBitrate}k -bufsize ${2*videoBitrate}k -maxrate ${videoBitrate}k \
-profile:v ${H264Profile[profile]} -level:v ${H264Level[level]} \
-payload_type ${videoPayloadType} -ssrc ${videoSsrc} -f rtp `;
        if (videoCrypto !== SRTPCryptoSuites.NONE) {
            videoffmpegCommand += `-srtp_out_suite ${SRTPCryptoSuites[videoCrypto]} -srtp_out_params ${videoSrtp} s`;
        }
        videoffmpegCommand += `rtp://${address}:${videoPort}?rtcpport=${videoPort}&localrtcpport=${videoPort + 10}&pkt_size=${maximalTransmissionUnit} \
-vf fps=1/5 -update 1 -y ${IPCameraExample.filename}`;
        console.log("FFMPEG command: ffmpeg " + videoffmpegCommand);
        const ffmpegVideo = spawn('ffmpeg', videoffmpegCommand.split(' '), {env: process.env});
        let started = false;
        ffmpegVideo.stderr.on('data', data => {
            if (!started) {
                started = true;
                console.log("FFMPEG: received first frame");
            }

            console.log("std-err: " + data);
        });
        ffmpegVideo.on('error', error => {
            console.log("[Video] Failed to start video stream: " + error.message);
        });
        ffmpegVideo.on('exit', (code, signal) => {
            const message = "[Video] ffmpeg exited with code: " + code + " and signal: " + signal + " (";

            if (code == null || code === 255) {
                console.log(message + "Video stream stopped!)");
            } else {
                console.log(message + "error)");
                this._forceStopController(sessionID);
            }
        });


        this.sourceState = SourceState.USED_VIDEO_STREAM;
        this.ongoingSessions[sessionIdentifier] = ffmpegVideo;

        delete this.pendingSessions[sessionIdentifier];
    };

    reconfigureStream(sessionIdentifier: string, request: StreamRequest) {
        const video = request.video!;

        console.log(`Received reconfigure with ${video.width}x${video.height} at ${video.fps} fps and ${video.max_bit_rate} kbps`);
        // TODO implement (CAN we implement it though?)
    };

    stopStream(sessionIdentifier: string) {
        if (!this.ongoingSessions[sessionIdentifier]) {
            console.log(`Got stop stream request but sessionIdentifier (${sessionIdentifier}) could not be found in ongoingSessions`);
            return;
        }

        const videoProcess = this.ongoingSessions[sessionIdentifier];
        try {
            videoProcess.kill('SIGKILL');
        } catch (e) {
            console.log("Error occurred terminating the video process!");
            console.log(e);
        }

        this.sourceState = SourceState.UNUSED;
        delete this.ongoingSessions[sessionIdentifier];

        if (fs.existsSync(IPCameraExample.filename))
            fs.unlinkSync(IPCameraExample.filename);
    };

    // noinspection JSUnusedGlobalSymbols
    createCameraControlService = () => {
        /*const controlService = new Service.CameraControl('', '');

        // Developer can add control characteristics like rotation, night vision at here.

        this.services.push(controlService);*/
    };

    _forceStopController(sessionID: SessionIdentifier) {
        for (let i = 0; i < this.streamControllers.length; i++) {
            const controller = this.streamControllers[i];
            if (controller.sessionIdentifier === sessionID) {
                controller.forceStop();
            }
        }
    };

// Private
    _createStreamControllers = (maxStreams: number, options: StreamControllerOptions) => {

        for (let i = 0; i < maxStreams; i++) {
            const streamController = new StreamController(i, options, this);

            this.services.push(streamController.service!);
            this.streamControllers.push(streamController);
        }
    }
}

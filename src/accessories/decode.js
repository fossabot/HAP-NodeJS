const string = "AR0BBKAPAAACCAEAAAAAAAAAAwsBAQACBgEEoA8AAAIkAQEAAhIBAQECAQIDBCADAAAEBKAPAAADCwECgAcCAjgEAwEeAxQBAQACDwEBAQIBAAMBAwQEQAAAAA==";
const buffer = Buffer.from(string, "base64");
console.log(buffer.toString("hex"));

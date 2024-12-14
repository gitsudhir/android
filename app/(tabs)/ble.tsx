import React, { useState, useEffect } from 'react';
import { ScrollView, Button, Text, View, Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device, BleError } from 'react-native-ble-plx';

// BLE Manager Initialization
const manager = new BleManager();

export default function BLEScreen() {
  const [devices, setDevices] = useState<Device[]>([]); // Stores devices found
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [color, setColor] = useState<string>('white'); // Assuming the BLE device sends color info
  const [logs, setLogs] = useState<string[]>([]); // State to store logs

  // Function to log events
  const logEvent = (message: string) => {
    setLogs((prevLogs) => [...prevLogs, `[LOG] ${message}`]);
    console.log(`[LOG] ${message}`);
  };

  // Function to log errors
  const logError = (error: any) => {
    setLogs((prevLogs) => [...prevLogs, `[ERROR] ${error}`]);
    console.error(`[ERROR] ${error}`);
  };

  // Request Android 12+ Permissions
  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      const isAndroid12OrHigher = Platform.Version >= 31;

      if (isAndroid12OrHigher) {
        const bluetoothScanPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const bluetoothConnectPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (bluetoothScanPermission === 'granted' && bluetoothConnectPermission === 'granted' && locationPermission === 'granted') {
          logEvent("Permissions granted for Android 12+.");
          return true;
        } else {
          logError("Bluetooth permissions not granted.");
          return false;
        }
      } else {
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (locationPermission === 'granted') {
          logEvent("Permissions granted for Android version < 12.");
          return true;
        } else {
          logError("Location permission not granted.");
          return false;
        }
      }
    }
    return true; // Automatically handled on iOS
  };

  useEffect(() => {
    const initPermissions = async () => {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        alert('Permissions are required to use Bluetooth');
      }
    };
    initPermissions();

    return () => {
      manager.destroy();
      logEvent("BLE Manager destroyed.");
    };
  }, []);

  // Start scanning for devices
  const scanForDevices = () => {
    setIsScanning(true);
    setDevices([]); // Clear previous devices list before scanning

    logEvent("Started scanning for devices...");

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        logError(`Failed to scan devices: ${error}`);
        return;
      }

      if (device && !devices.some((d) => d.id === device.id)) {
        logEvent(`Found device: ${device.name || device.id}`);
        setDevices((prevDevices) => [...prevDevices, device]);
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
      logEvent("Stopped scanning for devices.");
    }, 10000);
  };

  // Connect to a device and discover services & characteristics
  const connectToDevice = async (device: Device) => {
    try {
      logEvent(`Connecting to device: ${device.name || device.id}`);
      const deviceConnection = await manager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      setIsConnected(true);
      setIsScanning(false); // Stop scanning after connecting
      logEvent(`Connected to device: ${device.name || device.id}`);
      startStreamingData(deviceConnection); // Start streaming data after connection
    } catch (e) {
      logError(`Failed to connect to device: ${e}`);
    }
  };

  // Start streaming real-time data from the device
  const startStreamingData = async (device: Device) => {
    const DATA_SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214'; // Example UUID
    const COLOR_CHARACTERISTIC_UUID = '19b10001-e8f2-537e-4f6c-d104768a1217'; // Example UUID

    device.monitorCharacteristicForService(
      DATA_SERVICE_UUID,
      COLOR_CHARACTERISTIC_UUID,
      onDataUpdate
    );
    logEvent("Started streaming data from device.");
  };

  // Handle real-time data updates
  const onDataUpdate = (error: BleError | null, characteristic: any) => {
    if (error) {
      logError(`Error receiving data: ${error}`);
      return;
    }
    if (!characteristic?.value) {
      logEvent('No Data received');
      return;
    }

    const colorCode = Buffer.from(characteristic.value, 'base64').toString('utf8');
    setColor(colorCode);
    logEvent(`Received color data: ${colorCode}`);
  };

  // Send data to the connected device (e.g., control LED)
  const sendData = async (data: string) => {
    if (connectedDevice) {
      try {
        const serviceUUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Serial Port Profile service UUID
        const characteristicUUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Characteristic UUID for data transfer

        await connectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          characteristicUUID,
          data
        );
        logEvent(`Sent data: ${data}`);
      } catch (e) {
        logError(`Error sending data: ${e}`);
      }
    } else {
      alert('No device connected');
      logError("No device connected for sending data.");
    }
  };

  // Disconnect from the device
  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await manager.cancelDeviceConnection(connectedDevice.id);
        setIsConnected(false);
        setConnectedDevice(null);
        logEvent(`Disconnected from device: ${connectedDevice.name || 'Unknown Device'}`);
      } catch (e) {
        logError(`Error disconnecting: ${e}`);
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 24, marginBottom: 20 }}>Control LED via Bluetooth</Text>

        <Button title={isScanning ? 'Stop Scanning' : 'Scan for Devices'} onPress={scanForDevices} />

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18 }}>Devices:</Text>
          {devices.length === 0 ? (
            <Text>No devices found</Text>
          ) : (
            devices.map((device) => (
              <Button key={device.id} title={`Connect to ${device.name || device.id}`} onPress={() => connectToDevice(device)} />
            ))
          )}
        </View>

        {isConnected && connectedDevice && (
          <View style={{ marginTop: 20 }}>
            <Text>Connected to: {connectedDevice.name || 'Unknown Device'}</Text>
            <Button title="Disconnect" onPress={disconnectDevice} />
          </View>
        )}

        {isConnected && (
          <View style={{ marginTop: 20 }}>
            <Button title="Turn LED ON" onPress={() => sendData('1')} />
            <Button title="Turn LED OFF" onPress={() => sendData('0')} />
          </View>
        )}

        <Text style={{ marginTop: 20, fontSize: 18 }}>Color: {color}</Text>

        {/* Display logs */}
        <View style={{ marginTop: 30, width: '100%', maxHeight: 300 }}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>Logs:</Text>
          <ScrollView style={{ borderWidth: 1, padding: 10 }}>
            {logs.map((log, index) => (
              <Text
                key={index}
                style={{
                  fontSize: 14,
                  color: log.startsWith('[ERROR]') ? 'red' : 'black',
                }}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}

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

  // Request Android 12+ Permissions
  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      const isAndroid12OrHigher = Platform.Version >= 31;

      if (isAndroid12OrHigher) {
        // Android 12+ (API Level 31) permissions
        const bluetoothScanPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const bluetoothConnectPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        return (
          bluetoothScanPermission === 'granted' &&
          bluetoothConnectPermission === 'granted' &&
          locationPermission === 'granted'
        );
      } else {
        // Android versions lower than 12
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return locationPermission === 'granted';
      }
    }
    return true; // Automatically handled on iOS
  };

  // Request permissions on component mount
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
    };
  }, []);

  // Start scanning for devices
  const scanForDevices = () => {
    setIsScanning(true);
    setDevices([]); // Clear previous devices list before scanning

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Failed to scan devices', error);
        return;
      }

      // Avoid adding duplicate devices
      if (device && !devices.some((d) => d.id === device.id)) {
        // Add device to the list if it's either "Arduino" or any custom name
        if (device.localName === 'Arduino' || device.name === 'Arduino'|| device.name === 'HC-05') {
          setDevices((prevDevices) => [...prevDevices, device]);
        }
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  // Connect to a device and discover services & characteristics
  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await manager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      setIsConnected(true);
      setIsScanning(false); // Stop scanning after connecting
      startStreamingData(deviceConnection); // Start streaming data after connection
    } catch (e) {
      console.log('Failed to connect to device', e);
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
  };

  // Handle real-time data updates
  const onDataUpdate = (error: BleError | null, characteristic: any) => {
    if (error) {
      console.error(error);
      return;
    }
    if (!characteristic?.value) {
      console.log('No Data received');
      return;
    }

    // Assuming the data is a base64 string representing a color
    const colorCode = Buffer.from(characteristic.value, 'base64').toString('utf8');
    setColor(colorCode);
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
        console.log(`Sent data: ${data}`);
      } catch (e) {
        console.log('Error sending data', e);
      }
    } else {
      alert('No device connected');
    }
  };

  // Disconnect from the device
  const disconnectDevice = async () => {
    if (connectedDevice) {
      try {
        await manager.cancelDeviceConnection(connectedDevice.id);
        setIsConnected(false);
        setConnectedDevice(null);
      } catch (e) {
        console.log('Error disconnecting', e);
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 24, marginBottom: 20 }}>Control LED via Bluetooth</Text>

        {/* Start/Stop Scanning */}
        <Button title={isScanning ? 'Stop Scanning' : 'Scan for Devices'} onPress={scanForDevices} />

        {/* List of found devices */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18 }}>Devices:</Text>
          {devices.length === 0 ? (
            <Text>No devices found</Text>
          ) : (
            devices.map((device) => (
              <Button
                key={device.id}
                title={`Connect to ${device.name || device.id}`}
                onPress={() => connectToDevice(device)}
              />
            ))
          )}
        </View>

        {/* Connect/Disconnect Buttons */}
        {isConnected && connectedDevice && (
          <View style={{ marginTop: 20 }}>
            <Text>Connected to: {connectedDevice.name || 'Unknown Device'}</Text>
            <Button title="Disconnect" onPress={disconnectDevice} />
          </View>
        )}

        {/* LED control buttons */}
        {isConnected && (
          <View style={{ marginTop: 20 }}>
            <Button title="Turn LED ON" onPress={() => sendData('1')} />
            <Button title="Turn LED OFF" onPress={() => sendData('0')} />
          </View>
        )}

        {/* Display color received from the device */}
        <Text style={{ marginTop: 20, fontSize: 18 }}>Color: {color}</Text>
      </View>
    </ScrollView>
  );
}

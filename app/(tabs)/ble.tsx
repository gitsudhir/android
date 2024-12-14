import React, { useState, useEffect } from 'react';
import { ScrollView, Button, Text, View, Platform, PermissionsAndroid } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

const manager = new BleManager();

export default function BLEScreen() {
  const [devices, setDevices] = useState<Device[]>([]); // Stores paired devices
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Request Android permissions for Bluetooth
  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      const bluetoothPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH,
      );
      const bluetoothAdminPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      );
      const locationPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      return (
        bluetoothPermission === 'granted' &&
        bluetoothAdminPermission === 'granted' &&
        locationPermission === 'granted'
      );
    }
    return true; // Automatically handled on iOS
  };

  useEffect(() => {
    const initBluetooth = async () => {
      // Check if Bluetooth is enabled
      const isEnabled = await manager.enable();
      if (!isEnabled) {
        alert('Bluetooth is not enabled');
      }
    };
    initBluetooth();

    return () => {
      manager.destroy();
    };
  }, []);

  // Request necessary permissions on component mount
  useEffect(() => {
    const initPermissions = async () => {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        alert('Permissions are required to use Bluetooth');
      }
    };
    initPermissions();
  }, []);

  // Start scanning for Bluetooth devices
  const scanForDevices = () => {
    setIsScanning(true);
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Failed to scan devices', error);
        return;
      }

      // Avoid adding duplicate devices
      if (device && !devices.some((d) => d.id === device.id)) {
        setDevices((prevDevices) => [...prevDevices, device]);
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  // Connect to the selected device
  const connectToDevice = async (device: Device) => {
    try {
      await manager.connectToDevice(device.id);
      await device.discoverAllServicesAndCharacteristics();
      setConnectedDevice(device);
      setIsConnected(true);
      setIsScanning(false); // Stop scanning after connecting
    } catch (e) {
      console.log('Failed to connect to device', e);
    }
  };

  // Send data to Arduino via BLE (Control the LED)
  const sendData = async (data: string) => {
    if (connectedDevice) {
      try {
        // Using common UUIDs for Bluetooth serial communication
        const serviceUUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; // Default Serial Port Profile service UUID
        const characteristicUUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Default characteristic UUID for data transfer

        // Write the data to the connected device
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
        <Button title={isScanning ? 'Stop Scanning' : 'Scan for Devices B'} onPress={scanForDevices} />

        {/* List of paired devices */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 18 }}>Paired Devices:</Text>
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
      </View>
    </ScrollView>
  );
}

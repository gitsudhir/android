import React, { useState, useEffect } from 'react';
import { ScrollView, Button, Text, View, Platform, PermissionsAndroid } from 'react-native';
import BluetoothSerial from 'react-native-bluetooth-serial';

export default function BLEScreen() {
  const [devices, setDevices] = useState<any[]>([]); // Stores paired devices
  const [connectedDevice, setConnectedDevice] = useState<any | null>(null);
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
      const isEnabled = await BluetoothSerial.isEnabled();
      if (!isEnabled) {
        alert('Bluetooth is not enabled');
      }
    };
    initBluetooth();
  }, []);

  useEffect(() => {
    const setupBluetoothListener = async () => {
      // Make sure we have a valid device connection
      if (connectedDevice) {
        // Add event listener for data reception from the device
        BluetoothSerial.on('data', (data: any) => {
          console.log('Received data: ', data);
        });
      }
    };

    setupBluetoothListener();

    // Cleanup listener on component unmount or when device is disconnected
    return () => {
      BluetoothSerial.removeListener('data');
    };
  }, [connectedDevice]);

  useEffect(() => {
    const initPermissions = async () => {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        alert('Permissions are required to use Bluetooth');
      }
    };
    initPermissions();
  }, []);

  // Scan for Bluetooth devices
  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      await BluetoothSerial.discoverUnpairedDevices();
      const pairedDevices = await BluetoothSerial.list();
      setDevices(pairedDevices); // Show paired devices
    } catch (error) {
      console.error('Failed to scan devices', error);
    }
  };

  // Connect to the selected device (HC-05)
  const connectToDevice = async (device: any) => {
    try {
      await BluetoothSerial.connect(device.id);
      setConnectedDevice(device);
      setIsConnected(true);
      setIsScanning(false); // Stop scanning after connecting
    } catch (e) {
      console.log('Failed to connect to device', e);
    }
  };

  // Send data to Arduino via HC-05 (Control the LED)
  const sendData = async (data: string) => {
    if (connectedDevice) {
      try {
        await BluetoothSerial.write(data);
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
        await BluetoothSerial.disconnect();
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
};

import React, { useState, useEffect} from 'react';
import { Platform, Text, View, StyleSheet, Button, Alert, PermissionsAndroid} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import { RSA } from 'react-native-rsa-native';

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import Geolocation from 'react-native-geolocation-service';
import firestore from '@react-native-firebase/firestore';

const Stack = createNativeStackNavigator();
//Constructor para funciones de biometria
const rnBiometrics = new ReactNativeBiometrics();

const db =firestore()

/* db.collection("users").add({
  first: "Ada",
  last: "Lovelace",
  born: 1815
})
.then((docRef) => {
  console.log("Document written with ID: ", docRef.id);
})
.catch((error) => {
  console.error("Error adding document: ", error);
}); */

//funcion que comprueba que tu dispositivo se compatible con biometria
const Login = (props) => {
  const [biometrics, setBiometrics] = useState(false);

  useEffect(() => {
      rnBiometrics.isSensorAvailable().then((resultObject) => {
        const { available, biometryType } = resultObject

        if (available && biometryType === BiometryTypes.TouchID) {
          console.log('TouchID is supported');
          setBiometrics(true);
        } else if (available && biometryType === BiometryTypes.FaceID) {
          console.log('FaceID is supported');
          setBiometrics(true);
        } else if (available && biometryType === BiometryTypes.Biometrics) {
          console.log('Biometrics is supported');
          setBiometrics(true);
        } else {
          console.log('Biometrics not supported');
        }
      })
  },[]);

  return (
    <View style={styles.container}>
      <Text>
        {biometrics
          ? 'Your device is compatible with Biometrics'
          : 'Your device is NOT compatible with Biometrics'}
      </Text>
      <Button title="continue" onPress={() => props.navigation.navigate('Create')} />
    </View>
  );
};

const Create = (props) => {
  let publicKey;
  let epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString()
  let payload = epochTimeSeconds + 'some message'

  rnBiometrics.createKeys()
  .then((resultObject) => {
    publicKey = resultObject
    publicKey = publicKey.publicKey
    publicKey = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----'
  })

  rnBiometrics.biometricKeysExist()
  .then((resultObject) => {
    const { keysExist } = resultObject

    if (keysExist) {
      console.log('Keys exist')
      rnBiometrics.createSignature({
        promptMessage: 'Sign in',
        payload: payload
      })
      .then(async(resultObject) => {
        const { success, signature } = resultObject
    
        if (success) {
          console.log(payload)
          console.log(signature)
          console.log(publicKey)
          const valid = await RSA.verifyWithAlgorithm(signature,payload,publicKey,RSA.SHA256withRSA)
          .then((resultado) => console.log('RESULTADO' + resultado))
          .catch((err) => console.log(err));
          //verifySignatureWithServer(signature, payload)
        }
      })
    } else {
      console.log('Keys do not exist or were deleted')
    }
  })

  return (
    <View style={styles.container}>
      <Text>
        key save
      </Text>
      <Button title="continue" onPress={() => props.navigation.navigate('Geo')} />
    </View>
  )
}

// Function to get permission for location
const requestLocationPermission = async () => {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Geolocation Permission',
        message: 'Can we access your location?',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    console.log('granted', granted);
    if (granted === 'granted') {
      console.log('You can use Geolocation');
      return true;
    } else {
      console.log('You cannot use Geolocation');
      return false;
    }
  } catch (err) {
    return false;
  }
};

const Geo = () => {
  const [location, setLocation] = useState(false);

  // function to check permissions and get Location
  const getLocation = () => {
    const result = requestLocationPermission();
    result.then(res => {
      console.log('res is:', res);
      if (res) {
        Geolocation.getCurrentPosition(
          position => {
            console.log(position);
            setLocation(position);
          },
          error => {
            // See error code charts below.
            console.log(error.code, error.message);
            setLocation(false);
          },
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
        );
      }
    });
    console.log(location);
  };

  return (
    <View style={styles.container}>
      <Text>Welcome!</Text>
      <View
        style={{marginTop: 10, padding: 10, borderRadius: 10, width: '40%'}}>
        <Button title="Get Location" onPress={getLocation} />
      </View>
      <Text>Latitude: {location ? location.coords.latitude : null}</Text>
      <Text>Longitude: {location ? location.coords.longitude : null}</Text>
    </View>
  );
}

export default function App() {
  const [biometrics, setBiometrics] = useState(false);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name='Login' component={Login} />
        <Stack.Screen name='Create' component={Create} />
        <Stack.Screen name='Geo' component={Geo} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

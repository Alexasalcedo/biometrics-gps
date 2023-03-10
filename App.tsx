import React, { useState, useEffect} from 'react';
import { Platform, Text, View, StyleSheet, Button, Alert, PermissionsAndroid, TextInput} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import { RSA } from 'react-native-rsa-native';

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import Geolocation from 'react-native-geolocation-service';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const Stack = createNativeStackNavigator();
//Constructor para funciones de biometria
const rnBiometrics = new ReactNativeBiometrics();

const db = firestore()

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

const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleChangeText = (name, value) => {
      if(name === 'email'){
        setEmail(value);
        console.log(email);
      }
      if(name === 'password'){
        setPassword(value);
        console.log(password);
      }
  }

  const authorize = () => {
    auth().signInWithEmailAndPassword(email,password)
    .then((userCredential) => {
      var user = userCredential.user;
      console.log('Welcome: ' + user.email)
      props.navigation.navigate("CheckBiometrics");
    }).catch((error) => {
      var errorCode = error.code;
      var errorMessage = error.message;
      console.log(error)
    })
  }

  return (
    <View style={styles.container}>
      <View>
        <TextInput 
          placeholder='Email:'
          onChangeText={(value) => handleChangeText('email',value)}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Password:'
          onChangeText={(value) => handleChangeText('password',value)}
          secureTextEntry={true}
        />
      </View>
      <View>
        <Button title='Login' onPress={() => authorize()}/>
      </View>
    </View>
    
  );

}

const CheckBiometrics = (props) => {
  let epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString();
  let payload = epochTimeSeconds + 'some message';
  let uid;
  let data;
  let publicKey;

  const check = async() => {
    await auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
      } else {
        console.log('user is sign out');
      }
    })

    console.log('user id:')
    console.log(uid);

    await db.collection('Biometrics').where('user', '==', uid).get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());
        data = doc.data();
      });
    })
    publicKey = data.publickKey;
    console.log(publicKey);
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
            const valid = await RSA.verifyWithAlgorithm(signature,payload,publicKey,RSA.SHA256withRSA)
            .then((resultado) => console.log('RESULTADO' + resultado))
            .catch((err) => console.log(err));
          }
        })
      } else {
        console.log('Keys do not exist or were deleted')
      }
    })
  }
  return (
    <View style={styles.container}>
      <Text>
        Saving the biometric data
      </Text>
      <Button title="continue" onPress={() => check()} />
    </View>
  )
}

//funcion que comprueba que tu dispositivo se compatible con biometria
const SignIn = (props) => {
  const [biometrics, setBiometrics] = useState(false);
  const [secure, setSecure] = React.useState(props.secure);
  let nombre;
  let email;
  let password;

  const handleChangeText = (name, value) => {
    console.log(value);
    if(name === 'name'){
      nombre = value;
    } else if (name === 'email'){
      email = value;
    } else if (name === 'password'){
      password = value;
    }
    console.log(nombre,email,password)
  };

  const saveNewUser = async () => {
    if (nombre === '') {
      alert("please provide a name");
    } else {
      auth().createUserWithEmailAndPassword(email,password)
      .then(() => {
        console.log('User account created & signed in');
        props.navigation.navigate("AddBiometrics");
      }).catch(error => {
        if(error.code === 'auth/email-already-in-use'){
          console.log('That email address is already in use!');
        }
        if(error.code === 'auth/invalid-email'){
          console.log('That email address is invalid');
        }
        console.log(error);
      });
    }
  };

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
      <View>
        <TextInput 
          placeholder='Name:' 
          onChangeText={(value) => handleChangeText('name',value)}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Email:'
          onChangeText={(value) => handleChangeText('email',value)}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Password:'
          onChangeText={(value) => handleChangeText('password',value)}
          secureTextEntry={true}
        />
      </View>
      <View>
        <Button title='Sign In' onPress={() => saveNewUser()}/>
      </View>
      <View>
        <Button title='Login' onPress={() => props.navigation.navigate("Login")} />
      </View>
    </View>
    
  );
};

const AddBiometrics = (props) => {
  let publicKey;
  var uid;
  let epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString()
  let payload = epochTimeSeconds + 'some message'

  const saveBiometric = () => {
    try {
      db.collection("Biometrics").add({
        user: uid,
        publickKey: publicKey,
      }).then((docRef) => {
        console.log("Document written with ID: ", docRef.id);
      })
      .catch((error) => {
        console.error("Error adding document: ", error);
      });
      props.navigation.navigate("Geo");
    } catch (error) {
      console.log(error)
    } 
  }

  rnBiometrics.createKeys()
  .then((resultObject) => {
    publicKey = resultObject
    publicKey = publicKey.publicKey
    publicKey = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----'
  })
  auth().onAuthStateChanged((user) => {
    if(user){
      uid = user.uid;
      console.log('user id:')
      console.log(uid);
    } else {
      console.log('user is sign out');
    }
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
        Saving the biometric data
      </Text>
      <Button title="continue" onPress={() => saveBiometric()} />
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
        <Stack.Screen name='SignIn' component={SignIn} />
        <Stack.Screen name='AddBiometrics' component={AddBiometrics} />
        <Stack.Screen name='Geo' component={Geo} />
        <Stack.Screen name='Login' component={Login} />
        <Stack.Screen name='CheckBiometrics' component={CheckBiometrics} />
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

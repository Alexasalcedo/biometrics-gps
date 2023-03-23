import React, { useState, useEffect} from 'react';
import { Platform, Text, View, StyleSheet, Button, Alert, PermissionsAndroid, TextInput, Image, AppState} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RSA } from 'react-native-rsa-native';

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import Geolocation from 'react-native-geolocation-service';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
//Constructor para funciones de biometria
const rnBiometrics = new ReactNativeBiometrics();
const db = firestore();

// Helper function to calculate the distance between two points in meters
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Convert to meters
};

// Helper function to convert degrees to radians
const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

function haversine(coord1, coord2) {
  const R = 6371; // km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  console.log(R * c)
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

const DBlocation = async(uid) => {
  await db.collection('Locations').where('user', '==', uid).get()
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      console.log(doc.id, " => ", doc.data());
      data = doc.data();
      DbLatitude = data.latitude;
      Dblongitud = data.longitude;
      console.log(data)
      return data
    });
  })
}

const Watch = (props) => {
  const [position, setPosition] = useState(null);
  const [text, setText] = useState(null);
  let uid;
  let location;
  var filter = [];
  let destination = {
    latitude: 0,
    longitude: 0
  };
  const radius = 30; // meters

  const out = async() => {
    await auth().signOut().then(() => {
      console.log('Sucessful on log-out');
      props.navigation.navigate('SignIn');
    }).catch((error) => {
      console.log(error);
    })
  }

  const stopTime = async() => {
    await db.collection('Hours').orderBy('Inicio','desc').get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        data = doc.data();
        if (data.user == uid){
          filter.push(doc.id,data)
        }
      });
      out();
    })

    if (filter[0] != undefined){
      console.log(filter[0])
   
      var day = db.collection('Hours').doc(filter[0])
      return day.update({
        Fin: new Date()
      }).then(() => {
        console.log("Document successfully updated!");
      })
      .catch((error) => {
        // The document probably doesn't exist.
        console.error("Error updating document: ", error);
      });
    }
  } 

  const user = async() => {
    await auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
      } else {
        console.log('user is sign out');
      }
    })
    console.log('user id:')
    console.log(uid); 
    await db.collection('Locations').where('user', '==', uid).get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
        data = doc.data();
        destination = {
          latitude: data.latitude,
          longitude: data.longitude
        };
        console.log(data)
      });
    })
  }
  user();

  const pos = async() =>{
    const watchId = await Geolocation.watchPosition(
      position => {
        const distance = haversine(position.coords, destination) * 1000; // meters
        console.log(distance)
        if (distance <= radius) {
          setPosition(position);
          setText('Location is within range');
          console.log('Location is within range')
        } else {
          stopTime();
          setPosition(position);
          setText('Location is not within range');
          console.log('Location is not within range')
        }
      },
      error => console.log(error),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000,
        distanceFilter: 3
      }
    );

    return () => {
      Geolocation.clearWatch(watchId);
    };
  }

  useEffect(() => {
    pos();
  }, []);

  return (
    <View style={styles.container}>
      <View>
        <Image source={require('./img/mapa.png')} style={styles.image}/>
      </View>
      {position && (
        <Text style={styles.plainText}>
          Latitude: {position.coords.latitude},
          Longitude: {position.coords.longitude}
        </Text>
      )}
      {text && (
        <Text style={styles.card}>
          {text}
        </Text>
      )}
    </View>
  );
};

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
          style={styles.text}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Password:'
          onChangeText={(value) => handleChangeText('password',value)}
          secureTextEntry={true}
          style={styles.text}
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
            .then((resultado) => {
              console.log('RESULTADO' + resultado); 
              if(resultado === true){ 
                props.navigation.navigate("Main");
              }
            })
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
      <Text style={styles.card}>
        To continue, please confirm your identity
      </Text>
      <Button title="continue" onPress={() => check()} />
    </View>
  )
}

const CheckLocation = (props) => {
  const [location, setLocation] = useState(false);
  var ActLatitude;
  var Actlongitude;
  var DbLatitude;
  var Dblongitud;
  var uid;
  var data;
  var docId;

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

    await db.collection('Locations').where('user', '==', uid).get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
        data = doc.data();
        DbLatitude = data.latitude;
        Dblongitud = data.longitude;
      });
    })

    const result = requestLocationPermission();
    await result.then(res => {
      console.log('res is:', res);
      if (res) {
        Geolocation.getCurrentPosition(
          position => {
            ActLatitude = position ? position.coords.latitude : '';
            Actlongitude = position ? position.coords.longitude : '';
            console.log('latitude: ' + ActLatitude)
            console.log('longitude: ' + Actlongitude)
            setLocation(position);
            let meters = getDistanceFromLatLonInMeters(ActLatitude,Actlongitude,DbLatitude,Dblongitud);
            console.log('Meters: ', meters)
            if (meters < 30){
              try {
                db.collection("Hours").add({
                  user: uid,
                  Inicio: new Date(),
                  Fin: '',
                }).then((docRef) => {
                  console.log("Document written with ID: ", docRef.id);
                  console.log('Time start');
                  docId = docRef.id;
                  //props.navigation.navigate('Watch');
                })
                .catch((error) => {
                  console.error("Error adding document: ", error);
                });
              } catch (error) {
                console.log(error)
              }
            }
          },
          error => {
            // See error code charts below.
            console.log(error.code, error.message);
          },
          {enableHighAccuracy: true, timeout: 30000, maximumAge: 30000},
        );
      }
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.plainText}>Welcome!</Text>
      <Text style={styles.plainText}>Latitude: {location ? location.coords.latitude : null} </Text>
      <Text style={styles.plainText}>Longitude: {location ? location.coords.longitude : null}</Text>
      <View
        style={{marginTop: 10, padding: 10, borderRadius: 10, width: '40%'}}>
        <Button title="Get Location" onPress={check} />
      </View>
    </View>
  );
}

const LogOut = (props) => {
  var uid;
  var data;
  var filter = [];

  //Geolocation.stopObserving();

  const out = () => {
    auth().signOut().then(() => {
      console.log('Sucessful on log-out');
      props.navigation.navigate('SignIn');
    }).catch((error) => {
      console.log(error);
    })
  }

  const getHours = async() =>{
    await auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
      } else {
        console.log('user is sign out');
      }
    })
    console.log('user id:')
    console.log(uid);

    await db.collection('Hours').orderBy('Inicio','desc').get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        data = doc.data();
        if (data.user == uid){
          filter.push(doc.id,data)
        }
      });
      out();
    })

    if (filter[0] != undefined){
      console.log(filter[0])
   
      var day = db.collection('Hours').doc(filter[0])
      return day.update({
        Fin: new Date()
      }).then(() => {
        console.log("Document successfully updated!");
      })
      .catch((error) => {
        // The document probably doesn't exist.
        console.error("Error updating document: ", error);
      });
    }
  }

  return (
    <View style={styles.container}>
      <Text>
        Loging Out
      </Text>
      <Button title="continue" onPress={() => getHours()} />
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
      <View>
        <TextInput 
          placeholder='Name:' 
          onChangeText={(value) => handleChangeText('name',value)}
          style={styles.text}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Email:'
          onChangeText={(value) => handleChangeText('email',value)}
          style={styles.text}
        />
      </View>
      <View>
        <TextInput 
          placeholder='Password:'
          onChangeText={(value) => handleChangeText('password',value)}
          secureTextEntry={true}
          style={styles.text}
        />
      </View>
      <View style={{
        margin:10,
      }}>
        <Button title='Sign In' onPress={() => saveNewUser()}/>
      </View>
      <Text style={{marginTop:20,}}>
        You already have an account?
      </Text>
      <View>
        <Button title='Login' onPress={() => props.navigation.navigate("Login")} />
      </View>
      <Text style={styles.card}>
        {biometrics
          ? 'Your device is compatible with Biometrics'
          : 'Your device is NOT compatible with Biometrics'}
      </Text>
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

const Geo = (props) => {
  const [location, setLocation] = useState(false);

  const saveLocation = (latitude, longitude) => {
    let uid;
    auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
        console.log('user id:')
        console.log(uid);
        try {
          console.log('location')
          console.log(location)
          db.collection("Locations").add({
            user: uid,
            latitude: latitude,
            longitude: longitude,
          }).then((docRef) => {
            console.log("Document written with ID: ", docRef.id);
          })
          .catch((error) => {
            console.error("Error adding document: ", error);
          });
        } catch (error) {
          console.log(error)
        }
        props.navigation.navigate("Login");
      } else {
        console.log('user is sign out');
      }
    })

  }

  // function to check permissions and get Location
  const getLocation = async() => {
    var latitude;
    var longitude;
    const result = requestLocationPermission();
    await result.then(res => {
      console.log('res is:', res);
      if (res) {
        Geolocation.getCurrentPosition(
          position => {
            setLocation(position);
            console.log(location);

            latitude = position ? position.coords.latitude : '';
            longitude = position ? position.coords.longitude : '';
            console.log('latitude: ' + latitude)
            console.log('longitude: ' + longitude)
            saveLocation(latitude,longitude);
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

const MainNavigator = () => {
  return(
    <Tab.Navigator>
      <Tab.Screen name='CheckLocation' component={CheckLocation}/>
      <Tab.Screen name='Watch' component={Watch}/>
      <Tab.Screen name='LogOut' component={LogOut}/>
    </Tab.Navigator>
  )
} 

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name='SignIn' component={SignIn} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }} />
        <Stack.Screen name='AddBiometrics' component={AddBiometrics} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }}/>
        <Stack.Screen name='Geo' component={Geo} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }}/>
        <Stack.Screen name='Login' component={Login} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }}/>
        <Stack.Screen name='CheckBiometrics' component={CheckBiometrics} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }}/>
        <Stack.Screen name='Main' component={MainNavigator} options={{
          headerStyle:{
            backgroundColor: '#8C9EFF',
          },
          headerTintColor:'#F4FF81',
          headerTitleStyle:{
            fontWeight:'bold',
          },
          
        }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    elevation: 3,
    backgroundColor: '#5C6BC0',
  },
  text:{
    borderColor: 'gray',
    paddingLeft: 10,
    borderRadius: 5,
    margin: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#F9FBE7',
    minWidth: 250,
    minHeight: 30,
    alignItems: 'center',
    textAlign: 'center',
  },
  card:{
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 70,
    margin: 20,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    elevation: 3,
    backgroundColor: '#E0F2F1',
  },
  plainText:{
    fontSize:16,
    margin: 12,
  },
  image:{
    height:50,
    width:50,
  },
});

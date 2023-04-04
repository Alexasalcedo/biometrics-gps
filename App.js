import React, { useState, useEffect} from 'react';
import { Platform, Text, View, StyleSheet, Button, Alert, PermissionsAndroid, TextInput, Image, AppState} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';//Libreria para Navegacion de pantallas
import { NavigationContainer } from '@react-navigation/native';//Libreria para Navegacion de pantallas
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; //Libreria para anvegacion de pantallas

import { RSA } from 'react-native-rsa-native';//Liberia para conprobacion de llave de biometria
//cambio

import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics'; //Metodos de biometria
import Geolocation from 'react-native-geolocation-service';//Metodos de ubicacion
import firestore from '@react-native-firebase/firestore';//base de datos
import auth from '@react-native-firebase/auth'; //base de datos Usuarios

const Stack = createNativeStackNavigator();//funcion para navegacion de pantallas
const Tab = createBottomTabNavigator();//funcion para menu de navegacion de pantallas

//Constructor para funciones de biometria
//Constructor of Biometric functions
const rnBiometrics = new ReactNativeBiometrics();

//Constructor para base de datos
//Constructor od DB
const db = firestore();

// Helper function to calculate the distance between two points in meters
//Funcion para calcular la distancia entre dos puntos en metros
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km / Radio de la tierra en km
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
//Funcion para convertir grados a radianes
const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

// Helper function to calculate the distance between two points in meters
//Funcion para calcular la distancia entre dos puntos en metros
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

//Funcion para obtener la ubicacion (No se usa pero si se quita deja de funcionar)
//Function to obtain the location (It is not used but if it is removed it stops working)
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

//observa que la ubicacion este en rango
//Si el dispositivo sale de rango para en conteo de horas
//Watch that the location is whithin range 
//if the device get out of range stops the hours count
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
  //rango de distancia aceptada
  //range of accepted distance
  const radius = 30; // meters

  //Close the sesion
  //Cierra la sesion
  const out = async() => {
    await auth().signOut().then(() => {
      console.log('Sucessful on log-out');
      props.navigation.navigate('SignIn');
    }).catch((error) => {
      console.log(error);
    })
  }

  //Actualiza la base de datos con la hora actual para terminar conteo 
  //Update the database with the current hour for finish the count
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

  //obtetiene el id del usuario
  //get the user id
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

  //observa los cambios en la ubicacion y si esta esta en rango
  //Watch the changes on the location and if this one is on range
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
        distanceFilter: 3,
        showsBackgroundLocationIndicator: true,
      }
    );

    //Para la observacion de la ubicacion
    //Stop the tracking of the location
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

//LogIn
const Login = (props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  //Funcion para manejo de inputs
  //Function to handle inputs
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

  //Funcion para autorizar inicio de sesion
  //Function to authorize login
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

//Compueba que la biometria coincida con la guardada en la base de datos
//Check that the biometry matches the public key saved on the DB
const CheckBiometrics = (props) => {
  let epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString();
  let payload = epochTimeSeconds + 'some message';
  let uid;
  let data;
  let publicKey;

  const check = async() => {
    //Obtiene el id del usuario logeado
    //Get the id of the current user
    await auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
      } else {
        console.log('user is sign out');
      }
    })

    console.log('user id:')
    console.log(uid);

    //Obtiene la public key de la biometria de la base de datos 
    //la obtiene con el id de usuario
    //Get the public key of the biometry from the DB
    //gets it with the user id
    await db.collection('Biometrics').where('user', '==', uid).get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
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

        //obtiene una firma de biometria
        //create a biometric signature
        rnBiometrics.createSignature({
          promptMessage: 'Sign in',
          payload: payload
        })
        .then(async(resultObject) => {
          const { success, signature } = resultObject
      
          if (success) {
            console.log(payload)
            console.log(signature)

            //compara la firma con la llave publica de la base
            //compare the signature with the public key of the DB
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


//Comprueba que la ubicacion actual este en rango e inicia conteo de horas
//Check that the actual location is on the range and start hour count
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
    //obtiene el id del usuario
    //get the id of the user
    await auth().onAuthStateChanged((user) => {
      if(user){
        uid = user.uid;
      } else {
        console.log('user is sign out');
      }
    })
    console.log('user id:')
    console.log(uid);

    //Obtiene la ubicacion guardad en la base de datos
    //Get the location saved on the DB.
    await db.collection('Locations').where('user', '==', uid).get()
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
        data = doc.data();
        DbLatitude = data.latitude;
        Dblongitud = data.longitude;
      });
    })

    //Comprueba permiso de ubicacion y obtiene la ubicacion actual 
    //Si la ubicacion actual esta dentro del rango se inicia conteo de horas
    //Check location permission and get real location
    //If the current location is within the range, the hour count starts
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

            //toma la distancia en metros entre la ubicacion actual y la guardada en la base
            //takes the distance in meters between the current location and the one saved in the base
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

//Cierra sesion
//Log out
const LogOut = (props) => {
  var uid;
  var data;
  var filter = [];

  //Close the sesion
  //Cierra la sesion
  const out = () => {
    auth().signOut().then(() => {
      console.log('Sucessful on log-out');
      props.navigation.navigate('SignIn');
    }).catch((error) => {
      console.log(error);
    })
  }

  //Cierra en conteo de horas
  //Close the hours count
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

//Funcion para sign in // conprueba que el dispositivo sea compatible con biometria
//Sign In function // check that the device is compatible with biometrics
const SignIn = (props) => {
  const [biometrics, setBiometrics] = useState(false);//Estado de la compatibilidad de biometria
  const [secure, setSecure] = React.useState(props.secure);
  let nombre;
  let email;
  let password;

  //funcion para manejo de inputs
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

  //funcion para guardar nuevos usuarios en la base 
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

  //Funcion que comprueba la compativilidad del equipo con biometria 
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

//Añade datos de biometria a la base de datos
//Add biometric data to the DB
const AddBiometrics = (props) => {
  let publicKey;
  var uid;
  let epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString()
  let payload = epochTimeSeconds + 'some message'

  //Guarda la publick key en la base de datos
  //Save the public key on the DB
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

  //Obtiene la public key de la biometria
  //Create a publick key of the biometric data
  rnBiometrics.createKeys()
  .then((resultObject) => {
    publicKey = resultObject
    publicKey = publicKey.publicKey
    publicKey = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----'
  })

  //Obtiene el id del usuario
  //Get the id of the user
  auth().onAuthStateChanged((user) => {
    if(user){
      uid = user.uid;
      console.log('user id:')
      console.log(uid);
    } else {
      console.log('user is sign out');
    }
  })

  //Comprueba que existe una llave
  //Check that a key exist
  rnBiometrics.biometricKeysExist()
  .then((resultObject) => {
    const { keysExist } = resultObject

    if (keysExist) {
      console.log('Keys exist')

      //crea una firma de la biometria
      //creater a signature of the biometry
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
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
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

//Obtine la ubicacion y la guarda en la base de datos
//Get location and save it in the DB
const Geo = (props) => {
  const [location, setLocation] = useState(false);

  //Guarda la ubicacion en la base de datos
  //save the location in the DB
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
  //Funcion para revisar permisos y obtener ubicacion
  const getLocation = async() => {
    var latitude;
    var longitude;

    //obtiene permiso
    const result = requestLocationPermission();
    await result.then(res => {
      console.log('res is:', res);
      if (res) {

        //obtiene ubicacion
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
            // See error code.
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

//Menu de navegacion
const MainNavigator = () => {
  return(
    <Tab.Navigator>
      <Tab.Screen name='CheckLocation' component={CheckLocation}/>
      <Tab.Screen name='Watch' component={Watch}/>
      <Tab.Screen name='LogOut' component={LogOut}/>
    </Tab.Navigator>
  )
} 

//Main navigator
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

//Estilo de app
//App style
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

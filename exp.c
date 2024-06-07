#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>
#include "HX711.h"

// HX711 circuit wiring
const int LOADCELL_DOUT_PIN = 12;
const int LOADCELL_SCK_PIN = 13;

HX711 scale;

#define FIREBASE_HOST "saline-level-monitoring-server-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "63XsfziiFUKSfiv7HccwGizwRimnjmspbDldBEFv"
#define API_KEY "AIzaSyAOVLTyV5KM0TPxSSa-uSULFnaY6fYPHCU"
#define WIFI_SSID "P1N"
#define WIFI_PASSWORD "12345678"

FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  Serial.println("Initializing the scale");

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);

  Serial.println("Before setting up the scale:");
  Serial.print("read: \t\t");
  Serial.println(scale.read());      // print a raw reading from the ADC

  Serial.print("read average: \t\t");
  Serial.println(scale.read_average(20));   // print the average of 20 readings from the ADC

  Serial.print("get value: \t\t");
  Serial.println(scale.get_value(5));   // print the average of 5 readings from the ADC minus the tare weight (not set yet)

  Serial.print("get units: \t\t");
  Serial.println(scale.get_units(5), 1);  // print the average of 5 readings from the ADC minus tare weight (not set) divided
            // by the SCALE parameter (not set yet)
            
  scale.set_scale(-478.507);
  //scale.set_scale(-471.497);                      // this value is obtained by calibrating the scale with known weights; see the README for details
  scale.tare();               // reset the scale to 0

  Serial.println("After setting up the scale:");

  Serial.print("read: \t\t");
  Serial.println(scale.read());                 // print a raw reading from the ADC

  Serial.print("read average: \t\t");
  Serial.println(scale.read_average(20));       // print the average of 20 readings from the ADC

  Serial.print("get value: \t\t");
  Serial.println(scale.get_value(5));   // print the average of 5 readings from the ADC minus the tare weight, set with tare()

  Serial.print("get units: \t\t");
  Serial.println(scale.get_units(5), 1);        // print the average of 5 readings from the ADC minus tare weight, divided
            // by the SCALE parameter set with set_scale

  Serial.println("Readings:");

  // Firebase setup
  config.api_key = API_KEY;
  config.database_url = FIREBASE_HOST;
  
  Serial.println("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("Connected to ");
  Serial.println(WIFI_SSID);
  Serial.print("IP Address is : ");
  Serial.println(WiFi.localIP());

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase connection successful");
  } else {
    Serial.printf("Firebase connection failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  delay(1000);
}

void loop() {
  float weight = scale.get_units(5);
  Serial.print("one reading:\t");
  Serial.print(weight, 1);
  Serial.print("\t| average:\t");
  Serial.println(scale.get_units(10), 5);

  // Upload weight to Firebase
  if (Firebase.pushFloat(firebaseData, "/Storingdata", weight)) { 
    Serial.println("Storingdata Uploaded Successfully");
    Serial.print("Weight = ");
    Serial.println(weight);
    Serial.println("\n");
  } else {        
    Serial.println(firebaseData.errorReason());
  }

  if (Firebase.setFloat(firebaseData, "/Monitoringdata", weight)) { 
    Serial.println("Monitoringdata Uploaded Successfully");
    Serial.print("Weight = ");
    Serial.println(weight);
    Serial.println("\n");
  } else {        
    Serial.println(firebaseData.errorReason());
  }

  scale.power_down();             // put the ADC in sleep mode
  delay(5000);
  scale.power_up();
}
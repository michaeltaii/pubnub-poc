import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Pubnub from "pubnub";
import { PubNubProvider } from "pubnub-react";
import { v4 as uuidv4 } from "uuid";

import Home from "./screen/Home";

const Stack = createNativeStackNavigator();

const pubnub = new Pubnub({
  subscribeKey: "sub-c-2210c780-7446-11ec-8246-6ed6aa5c0c67",
  publishKey: "pub-c-6993021a-334a-426b-8383-7f2fc844e777",
  uuid: "massiveinfinity",
  secretKey: "sec-c-MGFjNjFlNWMtNzE3MS00MmNmLTljODAtNjkzZGVhMDUwMGUx",
});

export default function App() {
  return (
    <NavigationContainer>
      <PubNubProvider client={pubnub}>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={Home} />
        </Stack.Navigator>
      </PubNubProvider>
    </NavigationContainer>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useApp } from '../../context/AppContext';
import SetupScreen from '../screens/SetupScreen';
import ChatScreen from '../screens/ChatScreen';
import AddContactScreen from '../screens/AddContactScreen';
import ContactDetailScreen from '../screens/ContactDetailScreen';
import NewGroupScreen from '../screens/NewGroupScreen';
import NewChannelScreen from '../screens/NewChannelScreen';
import { TabNavigator } from './TabNavigator';

export type RootStackParamList = {
  Tabs: undefined;
  Setup: undefined;
  Chat: { id: string };
  AddContact: undefined;
  ContactDetail: { id: string };
  NewGroup: undefined;
  NewChannel: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isProfileSetup } = useApp();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      {!isProfileSetup ? (
        <Stack.Screen name="Setup" component={SetupScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="AddContact" component={AddContactScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="NewChannel" component={NewChannelScreen} options={{ animation: 'slide_from_right' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

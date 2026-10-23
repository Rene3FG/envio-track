import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import ConfirmarScreen from './src/screens/ConfirmarScreen';
import DetalleScreen from './src/screens/DetalleScreen';
import LoginScreen from './src/screens/LoginScreen';
import RutaScreen from './src/screens/RutaScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Ruta" component={RutaScreen} />
        <Stack.Screen name="Detalle" component={DetalleScreen} />
        <Stack.Screen name="Confirmar" component={ConfirmarScreen} />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

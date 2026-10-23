import { StyleSheet, Text, View } from 'react-native';

export default function RutaScreen() {
  return (
    <View style={styles.container}>
      <Text>Ruta</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

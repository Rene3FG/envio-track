import { StyleSheet, Text, View } from 'react-native';

export default function DetalleScreen() {
  return (
    <View style={styles.container}>
      <Text>Detalle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

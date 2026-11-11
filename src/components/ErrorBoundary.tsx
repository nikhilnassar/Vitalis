import React from 'react';
import { Text, View } from 'react-native';
import { reportError } from '../errors';
import { colors } from '../theme';
import { BigButton } from './ui';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    reportError(error, 'render');
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Text style={{ fontSize: 56 }}>🙈</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 12 }}>Something broke</Text>
        <Text style={{ color: colors.sub, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>Your data is safe on your phone. Try again, and if it keeps happening you can see the details under You, Settings, Error log.</Text>
        <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
          <BigButton label="Try again" emoji="🔄" onPress={() => this.setState({ failed: false })} />
        </View>
      </View>
    );
  }
}

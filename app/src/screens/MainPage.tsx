import { useState } from 'react';
import { Button, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import type { SyncStatus } from '../hooks/useMeasurements';
import { space, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';
import type { HomeState } from '../ui/homeState';
import { Reading } from '../ui/Reading';

/** キャラ・湿度とカメラARへの入口。更新は pull-to-refresh で行う。 */
export function MainPage({ home, status, onRefresh, onOpenAR, bottomInset }: {
  home: HomeState;
  status: SyncStatus;
  onRefresh: () => void;
  onOpenAR: () => void;
  bottomInset: number;
}) {
  const scheme = useScheme();
  const [pulled, setPulled] = useState(false);
  if (pulled && status !== 'loading') setPulled(false);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      refreshControl={
        <RefreshControl
          refreshing={pulled && status === 'loading'}
          onRefresh={() => { setPulled(true); onRefresh(); }}
          tintColor={scheme.primary}
          colors={[scheme.primary]}
          progressBackgroundColor={scheme.surfaceContainerHigh}
        />
      }
    >
      <Character mood={home.mood} size={276} />
      <Reading state={home.reading} />
      <Button title="AR画面を開く" onPress={onOpenAR} color={scheme.primary} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.s24 },
});

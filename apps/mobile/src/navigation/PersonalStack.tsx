import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { MyHabitsScreen } from '../screens/personal/MyHabitsScreen';
import { PersonalHabitDetailScreen } from '../screens/personal/PersonalHabitDetailScreen';

export type PersonalStackParamList = {
  MyHabits: undefined;
  PersonalHabitDetail: { habitId: string; name?: string };
};

const Stack = createNativeStackNavigator<PersonalStackParamList>();

export function PersonalStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="MyHabits"
        component={MyHabitsScreen}
        options={{ title: 'My Habits' }}
      />
      <Stack.Screen
        name="PersonalHabitDetail"
        component={PersonalHabitDetailScreen}
        options={({ route }) => ({ title: route.params.name ?? 'Habit' })}
      />
    </Stack.Navigator>
  );
}

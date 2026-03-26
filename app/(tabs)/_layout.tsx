import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconName;
  iconFocused: IoniconName;
}

const TABS: TabConfig[] = [
  {
    name: 'index',
    title: 'ホーム',
    icon: 'home-outline',
    iconFocused: 'home',
  },
  {
    name: 'injection',
    title: '投与記録',
    icon: 'medical-outline',
    iconFocused: 'medical',
  },
  {
    name: 'nutrition',
    title: '栄養管理',
    icon: 'restaurant-outline',
    iconFocused: 'restaurant',
  },
  {
    name: 'exercise',
    title: '運動記録',
    icon: 'fitness-outline',
    iconFocused: 'fitness',
  },
  {
    name: 'settings',
    title: '設定',
    icon: 'settings-outline',
    iconFocused: 'settings',
  },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

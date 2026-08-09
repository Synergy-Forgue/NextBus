import { Redirect } from 'expo-router';
import { useDriverStore } from '../src/store/driverStore';

/** Entry route: logged-in drivers land on the tabs, everyone else on splash. */
export default function Index() {
  const { isLoggedIn } = useDriverStore();
  return <Redirect href={isLoggedIn ? '/(tabs)' : '/splash'} />;
}

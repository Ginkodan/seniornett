import { fetchWeatherAction, searchLocationsAction } from "./actions/weather";
import { HomeScreen } from "../components/home-screen";

export default async function Page() {
  return (
    <HomeScreen
      initialWeather={null}
      fetchWeatherAction={fetchWeatherAction}
      searchLocationsAction={searchLocationsAction}
    />
  );
}

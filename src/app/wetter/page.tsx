import { fetchWeatherAction, searchLocationsAction } from "../actions/weather";
import { WeatherScreen } from "../../components/weather-screen";

export default function WetterPage() {
  return (
    <WeatherScreen
      fetchWeatherAction={fetchWeatherAction}
      searchLocationsAction={searchLocationsAction}
    />
  );
}

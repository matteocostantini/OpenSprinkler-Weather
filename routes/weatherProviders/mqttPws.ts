import * as mqtt from "mqtt";

import { addObservation, hasObservations, LocalObservation } from "./local";

export interface TemperatureReading {
	timestamp: number;
	temperature: number;
	humidity: number;
}

export interface RainReading {
	timestamp: number;
	rainRate: number;
	rainLast24Hours: number;
}

export function startMqttPws(): mqtt.MqttClient {
	const url = requireEnvironmentVariable( "MQTT_URL" );
	const weatherTopic = requireEnvironmentVariable( "MQTT_WEATHER_TOPIC" );
	const rainTopic = requireEnvironmentVariable( "MQTT_RAIN_TOPIC" );
	const client = mqtt.connect( url, {
		username: process.env.MQTT_USERNAME,
		password: process.env.MQTT_PASSWORD
	} );

	let temperature: TemperatureReading;
	let rain: RainReading;
	let lastRainTotal: number;
	let lastObservationTimestamp: number;

	client.on( "connect", function() {
		client.subscribe( [ weatherTopic, rainTopic ], function( err ) {
			if ( err ) {
				console.error( "Unable to subscribe to MQTT PWS topics:", err );
				return;
			}
			console.log( "Subscribed to MQTT PWS topics on %s", url );
		} );
	} );

	client.on( "error", function( err ) {
		console.error( "MQTT PWS connection error:", err );
	} );

	client.on( "message", function( topic, payload ) {
		try {
			if ( topic === weatherTopic ) {
				temperature = parseTemperaturePayload( payload.toString() );
			} else if ( topic === rainTopic ) {
				rain = parseRainPayload( payload.toString() );
			}

			if ( !temperature || !rain || temperature.timestamp === lastObservationTimestamp ) {
				return;
			}

			const observation = makeObservation( temperature, rain, lastRainTotal, hasObservations() );
			addObservation( observation );
			lastRainTotal = rain.rainLast24Hours;
			lastObservationTimestamp = temperature.timestamp;
		} catch ( err ) {
			console.error( "Invalid MQTT PWS message on topic %s:", topic, err );
		}
	} );

	return client;
}

export function parseTemperaturePayload( payload: string ): TemperatureReading {
	const data = JSON.parse( payload );
	const dashboard = data.dashboard_data;

	if ( !dashboard || !isNumber( dashboard.time_utc ) ||
		!isNumber( dashboard.Temperature ) || !isNumber( dashboard.Humidity ) ) {
		throw new Error( "Temperature payload is missing time_utc, Temperature, or Humidity." );
	}

	return {
		timestamp: dashboard.time_utc,
		temperature: dashboard.Temperature,
		humidity: dashboard.Humidity
	};
}

export function parseRainPayload( payload: string ): RainReading {
	const data = JSON.parse( payload );
	const dashboard = data.dashboard_data;

	if ( !dashboard || !isNumber( dashboard.time_utc ) ||
		!isNumber( dashboard.Rain ) || !isNumber( dashboard.sum_rain_24 ) ) {
		throw new Error( "Rain payload is missing time_utc, Rain, or sum_rain_24." );
	}

	return {
		timestamp: dashboard.time_utc,
		rainRate: dashboard.Rain,
		rainLast24Hours: dashboard.sum_rain_24
	};
}

export function makeObservation(
	temperature: TemperatureReading,
	rain: RainReading,
	lastRainTotal: number,
	existingObservations: boolean
): LocalObservation {
	let rainfall = 0;

	if ( lastRainTotal === undefined ) {
		rainfall = existingObservations ? 0 : rain.rainLast24Hours;
	} else {
		rainfall = Math.max( 0, rain.rainLast24Hours - lastRainTotal );
	}

	return {
		timestamp: Math.max( temperature.timestamp, rain.timestamp ),
		temp: temperature.temperature * 9 / 5 + 32,
		humidity: temperature.humidity,
		precip: rainfall / 25.4,
		raining: rain.rainRate > 0
	};
}

function requireEnvironmentVariable( name: string ): string {
	const value = process.env[ name ];
	if ( !value ) {
		throw new Error( name + " environment variable is not defined." );
	}
	return value;
}

function isNumber( value: any ): value is number {
	return typeof value === "number" && isFinite( value );
}

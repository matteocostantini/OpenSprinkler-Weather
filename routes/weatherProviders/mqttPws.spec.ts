import { expect } from "chai";

import {
	makeObservation,
	parseRainPayload,
	parseTemperaturePayload
} from "./mqttPws";

describe( "MQTT PWS", () => {
	it( "parses Netatmo outdoor module data", () => {
		const reading = parseTemperaturePayload( JSON.stringify( {
			dashboard_data: {
				time_utc: 1795530681,
				Temperature: 14.9,
				Humidity: 64
			}
		} ) );

		expect( reading ).to.eql( {
			timestamp: 1795530681,
			temperature: 14.9,
			humidity: 64
		} );
	} );

	it( "parses Netatmo rain module data", () => {
		const reading = parseRainPayload( JSON.stringify( {
			dashboard_data: {
				time_utc: 1795530713,
				Rain: 0.5,
				sum_rain_24: 2.54
			}
		} ) );

		expect( reading ).to.eql( {
			timestamp: 1795530713,
			rainRate: 0.5,
			rainLast24Hours: 2.54
		} );
	} );

	it( "converts Netatmo units for the local weather provider", () => {
		const observation = makeObservation(
			{ timestamp: 1795530681, temperature: 10, humidity: 64 },
			{ timestamp: 1795530713, rainRate: 0.5, rainLast24Hours: 5.08 },
			2.54,
			true
		);

		expect( observation.timestamp ).to.equal( 1795530713 );
		expect( observation.temp ).to.equal( 50 );
		expect( observation.humidity ).to.equal( 64 );
		expect( observation.precip ).to.be.closeTo( 0.1, 0.00001 );
		expect( observation.raining ).to.equal( true );
	} );
} );

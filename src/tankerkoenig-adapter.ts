/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property } from 'gateway-addon';
import fetch from 'node-fetch';

interface ListResult {
    stations: Station[]
}

interface Station {
    id: string,
    name: string
}

interface DetailResult {
    station: StationDetail
}

interface StationDetail {
    e5: number,
    e10: number,
    diesel: number
}

class GasStation extends Device {
    private e5: Property;
    private e10: Property;
    private diesel: Property;

    constructor(adapter: any, private manifest: any, private station: Station) {
        super(adapter, station.id);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this.name = station.name;
        this.description = station.name;

        this.e5 = this.createProperty('e5', {
            type: 'number',
            title: 'E5 price',
            description: 'The current E5 price',
            readOnly: true
        });

        this.e10 = this.createProperty('e10', {
            type: 'number',
            title: 'E10 price',
            description: 'The current E10 price',
            readOnly: true
        });

        this.diesel = this.createProperty('diesel', {
            type: 'number',
            title: 'Diesel price',
            description: 'The current diesel price',
            readOnly: true
        });
    }

    createProperty(id: string, description: {}): Property {
        const property = new Property(this, id, description);
        this.properties.set(id, property);
        return property;
    }

    public startPolling(seconds: number) {
        setInterval(() => this.poll(), seconds * 1000);
        this.poll();
    }

    async poll() {
        const {
            apiKey
        } = this.manifest.moziot.config;

        const url = `https://creativecommons.tankerkoenig.de/json/detail.php?id=${this.station.id}&apikey=${apiKey}`;

        const result = await fetch(url);
        const response = <DetailResult>await result.json();
        const station = response.station;

        this.e5.setCachedValue(station.e5);
        this.notifyPropertyChanged(this.e5);

        this.e10.setCachedValue(station.e10);
        this.notifyPropertyChanged(this.e10);

        this.diesel.setCachedValue(station.diesel);
        this.notifyPropertyChanged(this.diesel);
    }
}

export class TankerkoenigAdapter extends Adapter {
    constructor(addonManager: any, manifest: any) {
        super(addonManager, TankerkoenigAdapter.name, manifest.name);
        addonManager.addAdapter(this);

        const {
            apiKey,
            latitude,
            longitude,
            radius
        } = manifest.moziot.config;

        const url = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${latitude}&lng=${longitude}&rad=${radius}&type=all&apikey=${apiKey}`;

        (async () => {
            const result = await fetch(url);
            const response = <ListResult>await result.json();

            for (const station of response.stations) {
                console.log(`Found gas station ${station.name}`);
                const gasStation = new GasStation(this, manifest, station);
                this.handleDeviceAdded(gasStation);
                gasStation.startPolling(5 * 60);
            }
        })();
    }
}

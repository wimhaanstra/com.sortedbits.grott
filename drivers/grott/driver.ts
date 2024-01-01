import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { connectAsync } from 'mqtt';

class GrottDriver extends Homey.Driver {
  host: string = '';
  port: string = '';
  username: string | undefined = undefined;
  password: string | undefined = undefined;
  topic: string = '';

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('GrottDriver has been initialized');
  }

  async _testPairing(data: any, session: PairSession) {
    if (data.host && data.port && data.topic) {

      this.host = data.host;
      this.port = data.port ?? '1883';
      this.username = data.username;
      this.password = data.password;
      this.topic = data.topic;

      try {
        this.log('Connecting to broker at ', this.host);
        const connection = await connectAsync(`mqtt://${this.host}`, {
          username: this.username,
          password: this.password,
          port: Number(this.port),
        });

        if (connection.connected) {
          this.log('Connected succesfully, closing connection');

          connection.end();
          session.nextView();

          return {
            success: true,
          }
        } else {
          this.log('Not connected?');
          return {
            success: false,
            message: 'Unable to connect, unknown error'
          };
        }
      } catch (error) {
        this.log('Failed to connect with error', error);
        return {
          success: false,
          message: error
        }
      }
    }
  }

  async onPair(session: PairSession) {
    await session.done();

    session.setHandler("form_complete", async (data) => {
      this.log('Calling testPairing with ', data);
      return await this._testPairing(data, session);
    });

    session.setHandler("showView", async (view) => {
    });

    session.setHandler("list_devices", async () => {
      return [
        {
          name: `Grott MQTT`,
          data: {
            id: `${this.username}:${this.password}@${this.host}:${this.port}/${this.topic}`,
          },
          settings: {
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            topic: this.topic
          }
        }
      ];
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
      // Example device data, note that `store` is optional
      // {
      //   name: 'My Device',
      //   data: {
      //     id: 'my-device',
      //   },
      //   store: {
      //     address: '127.0.0.1',
      //   },
      // },
    ];
  }

}

module.exports = GrottDriver;

import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { connectAsync } from 'mqtt';

interface TestPairingResult {
  success: boolean;
  message?: unknown;
}

class GrottDriver extends Homey.Driver {

  host: string = '';
  port: string = '';
  protocol: string = 'mqtt';
  username: string | undefined = undefined;
  password: string | undefined = undefined;
  topic: string = '';
  validateCertificate: boolean = true;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('GrottDriver has been initialized');
  }

  async _testPairing(
    data: any,
    session: PairSession,
  ): Promise<TestPairingResult> {
    if (data.host && data.port && data.topic) {
      this.host = data.host;
      this.port = data.port ?? '1883';
      this.protocol = data.protocol ?? 'mqtt';
      this.username = data.username;
      this.password = data.password;
      this.topic = data.topic;

      if (data.validateCertificate !== undefined && data.validateCertificate === 'false') {
        this.validateCertificate = false;
      } else {
        this.validateCertificate = true;
      }

      try {
        this.log('Connecting to broker at ', this.host);
        const connection = await connectAsync(`${this.protocol}://${this.host}`, {
          username: this.username,
          password: this.password,
          port: Number(this.port),
          rejectUnauthorized: this.validateCertificate,
        });

        if (connection.connected) {
          this.log('Connected succesfully, closing connection');

          connection.end();
          await session.nextView();

          return {
            success: true,
          };
        }
        this.log('Not connected?');
        return {
          success: false,
          message: 'Unable to connect, unknown error',
        };
      } catch (error) {
        this.log('Failed to connect with error', error);
        return {
          success: false,
          message: error,
        };
      }
    }

    return {
      success: false,
      message: 'Missing host, port or topic values',
    };
  }

  async onPair(session: PairSession) {
    session.setHandler('form_complete', async (data) => {
      this.log('Calling testPairing with ', data);
      return this._testPairing(data, session);
    });

    session.setHandler('list_devices', async () => {
      return [
        {
          name: 'Grott MQTT',
          data: {
            id: `${this.username}:${this.password}@${this.host}:${this.port}/${this.topic}`,
          },
          settings: {
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            topic: this.topic,
            protocol: this.protocol,
            validateCertificate: this.validateCertificate,
          },
        },
      ];
    });
  }

}

module.exports = GrottDriver;

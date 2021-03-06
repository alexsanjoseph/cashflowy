/**
 * Development environment settings
 *
 * This file can include shared settings for a development team,
 * such as API keys or remote database passwords.  If you're using
 * a version control solution for your Sails app, this file will
 * be committed to your repository unless you add it to your .gitignore
 * file.  If your repository will be publicly viewable, don't add
 * any private information to this file!
 *
 */

module.exports = {

	/***************************************************************************
	 * Set the default database connection for models in the development       *
	 * environment (see config/connections.js and config/models.js )           *
	 ***************************************************************************/
	connections: {
		mainPostgresqlServer: {
			adapter: 'sails-postgresql',
			host: process.env.DB_HOST,
			user: process.env.DB_USER, // optional
			password: process.env.DB_PASSWORD, // optional
			database: process.env.DB_DATABASE //optional
		}
	},
	redis_kue: {
		host: '127.0.0.1',
		port: 6379,
		db: 4,
	},
	session: {
		adapter: 'connect-redis',
		host: '127.0.0.1',
		port: 6379,
		db: 0,
	},
	slack_webhook: process.env.SLACK_WEBHOOK,
	mailgun: {
		api_key: process.env.MAILGUN_APIKEY,
		domain: process.env.MAILGUN_DOMAIN
	}
};

const path = require('path')
const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')

module.exports = merge(
    commonConfiguration,
    {
        stats: 'errors-warnings',
        mode: 'development',
        infrastructureLogging:
        {
            level: 'warn'
        },
        devServer:
        {
            host: 'local-ip',
            port: 8080,
            open: true,
            allowedHosts: 'all',
            hot: true,
            watchFiles: ['src/**', 'static/**'],
            static:
            {
                directory: path.resolve(__dirname, '../static')
            },
            client:
            {
                overlay: true,
                logging: 'warn'
            }
        }
    }
)
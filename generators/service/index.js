var generators = require('yeoman-generator');
var fs = require('fs');
var inflect = require('i')();
var transform = require('../../lib/transform');

function importService(filename, name, moduleName) {
  // Lookup existing service/index.js file
  if (fs.existsSync(filename)) {
    var content = fs.readFileSync(filename).toString();
    var ast = transform.parse(content);
    
    transform.addImport(ast, name, moduleName);
    transform.addLastInFunction(ast, 'module.exports', 'app.configure(' + name + ');');
    
    fs.writeFileSync(filename, transform.print(ast));
  }
}

module.exports = generators.Base.extend({
  initializing: function (name) {
    this.props = { name: name, authentication: false };

    this.props = Object.assign(this.props, this.options);
  },

  prompting: function () {
    var done = this.async();
    var options = this.options;
    var prompts = [
      {
        name: 'name',
        message: 'What do you want to call your service?',
        default: this.props.name,
        when: function(){
          return options.name === undefined;
        }
      },
      {
        type: 'list',
        name: 'type',
        message: 'What type of service do you need?',
        default: this.props.type,
        store: true,
        when: function(){
          return options.type === undefined;
        },
        choices: [
          {
            name: 'generic',
            value: 'generic',
            checked: true
          },
          {
            name: 'database',
            value: 'database'
          }
        ]
      },
      {
        type: 'list',
        name: 'database',
        message: 'For which database?',
        store: true,
        default: this.props.database,
        when: function(answers){
          return options.database === undefined && answers.type === 'database';
        },
        choices: [
          {
            name: 'Memory',
            value: 'memory'
          },
          {
            name: 'MongoDB',
            value: 'mongodb'
          },
          {
            name: 'MySQL',
            value: 'mysql'
          },
          {
            name: 'MariaDB',
            value: 'mariadb'
          },
          {
            name: 'NeDB',
            value: 'nedb'
          },
          {
            name: 'PostgreSQL',
            value: 'postgres'
          },
          {
            name: 'SQLite',
            value: 'sqlite'
          },
          {
           name: 'SQL Server',
           value: 'mssql'
          }
        ]
      },
      {
        type: 'confirm',
        name: 'authentication',
        default: this.props.authentication,
        message: 'Does your service require users to be authenticated?',
        when: function(){
          return options.authentication === undefined;
        }
      }
    ];

    this.prompt(prompts, function (props) {
      this.props = Object.assign(this.props, props);
      done();
    }.bind(this));
  },

  writing: function () {
    // Generate the appropriate service based on the database.
    if (this.props.type === 'database') {
      switch(this.props.database) {
        case 'sqlite':
        case 'mssql':
        case 'mysql':
        case 'mariadb':
        case 'postgres':
          this.npmInstall(['feathers-sequelize'], { save: true });
          this.props.type = 'sequelize';
          break;
        case 'mongodb':
          this.npmInstall(['feathers-mongoose'], { save: true });
          this.props.type = 'mongoose';
          break;
        case 'memory':
          this.npmInstall(['feathers-memory'], { save: true });
          this.props.type = 'memory';
          break;
        case 'nedb':
          this.npmInstall(['feathers-nedb'], { save: true });
          this.props.type = 'nedb';
          break;
        default:
          this.props.type = 'generic';
          break;
      }
    }

    this.props.pluralizedName = inflect.pluralize(this.props.name);

    var serviceIndexPath = this.destinationPath('src/services/index.js');

    this.fs.copyTpl(
      this.templatePath(this.props.type + '-service.js'),
      this.destinationPath('src/services', this.props.name, 'index.js'),
      this.props
    );

    // Automatically import the new service into services/index.js and initialize it.
    importService(serviceIndexPath, this.props.name, './' + this.props.name);

    // Add a hooks folder for the service
    this.fs.copyTpl(
      this.templatePath('hooks.js'),
      this.destinationPath('src', 'services', this.props.name, 'hooks', 'index.js'),
      this.props
    );
    
    this.fs.copyTpl(
      this.templatePath('index.test.js'),
      this.destinationPath('test', 'services', this.props.name, 'index.test.js'),
      this.props
    );

    // If we are generating a service that requires a model, let's generate that model.
    if (this.props.type === 'mongoose' || this.props.type === 'sequelize') {
      this.composeWith('feathers:model', {
        options: {
          type: this.props.type,
          name: this.props.name,
          service: this.props.name
        }
      });
    }
  }
});

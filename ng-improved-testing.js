/**
 * @license ngImprovedTesting
 * (c) 2014 Emil van Galen. https://github.com/evangalen/ng-improved-testing
 * License: MIT
 */
(function() { 'use strict';

angular.module('ngImprovedTesting', ['ngImprovedTesting.$q']);

/* global afterEach:true */
var ngImprovedTestingConfigFlags = {
    $qTick: false
};

var ngImprovedTestingConfig = {
    $qTickEnable: function() {
        afterEach(function() {
            ngImprovedTestingConfigFlags.$qTick = false;
        });

        return function() {
            ngImprovedTestingConfigFlags.$qTick = true;
        };
    }
};

angular.module('ngImprovedTesting.internal.config', [])
    .constant('ngImprovedTestingConfigFlags', ngImprovedTestingConfigFlags)
    .constant('ngImprovedTestingConfig', ngImprovedTestingConfig);

/**
 * @ngdoc service
 * @constructor
 */
function MockCreator() {

    /**
     * @param {*} value
     * @returns {boolean}
     */
    this.canInstanceBeMocked = function (value) {
        return angular.isFunction(value) || isObjectWithMethods(value);
    };

    /**
     * @param {(Function|Object)} value
     * @returns {(Function|Object)}
     */
    this.mockInstance = function (value) {
        if (angular.isFunction(value)) {
            return createFunctionMock(value);
        } else if (isObjectWithMethods(value)) {
            return createObjectMock(value);
        } else {
            throw 'Could not mock provided value: ' + value;
        }
    };

    function isObjectWithMethods(value) {
        if (!angular.isObject(value)) {
            return false;
        }

        for (var propertyName in value) { // jshint ignore:line
            var propertyValue = value[propertyName];

            if (angular.isFunction(propertyValue) && propertyName !== 'constructor' &&
                    propertyValue !== Object.prototype[propertyName]) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param {Function} value
     * @returns {Function}
     */
    function createFunctionMock(value) {
        if (!hasProperties(value) && !hasProperties(value.prototype, 'constructor')) {
            return jasmine.createSpy();
        }

        var Constructor = jasmine.createSpy();

        copyPropertiesAndReplaceWithSpies(value, Constructor, true);

        Constructor.prototype = Object.create(value.prototype);
        copyPropertiesAndReplaceWithSpies(value.prototype, Constructor.prototype, true, 'constructor');
        Constructor.prototype.constructor = value.prototype.constructor;

        return Constructor;
    }

    /**
     * @param {Object} obj
     * @param {...string} ignoreProperties
     */
    function hasProperties(obj, ignoreProperties) {
        for (var propertyName in obj) {
            if (obj.hasOwnProperty(propertyName) &&
                    (!ignoreProperties || ignoreProperties.indexOf(propertyName) === -1)) {
                return true;
            }
        }

        return false;
    }

    function createObjectMock(obj) {
        var result = {};

        copyPropertiesAndReplaceWithSpies(obj, result, false, 'constructor');

        return result;
    }

    /**
     * @param {Object} source
     * @param {Object} target
     * @param {boolean} onlyOwnProperties
     * @param {...string} ignoreProperties
     */
    function copyPropertiesAndReplaceWithSpies(source, target, onlyOwnProperties, ignoreProperties) {
        ignoreProperties = Array.prototype.slice.call(arguments, 3);

        for (var propertyName in source) { // jshint ignore:line
            if (onlyOwnProperties && !source.hasOwnProperty(propertyName)) {
                continue;
            }

            var propertyValue = source[propertyName];

            if ((onlyOwnProperties || (!onlyOwnProperties && propertyValue !== Object.prototype[propertyName])) &&
                    (!ignoreProperties || ignoreProperties.indexOf(propertyName) === -1)) {
                if (angular.isFunction(propertyValue)) {
                    target[propertyName] = jasmine.createSpy(propertyName);
                } else {
                    target[propertyName] = propertyValue;
                }
            }
        }
    }
}

angular.module('ngImprovedTesting.internal.mockCreator', [])
    .service('mockCreator', MockCreator);

// @ngInject
function moduleBuilderFactory(moduleIntrospector, mockCreator) {

    /**
     * @constructor
     */
    function ModuleBuilder(moduleName) {

        /**
         * @param {string} providerName
         * @param {string} componentName
         * @param {string} componentKind
         * @param {string} [dependenciesUsage]
         * @param {Array.<string>} [dependencies]
         */
        function includeProviderComponent(providerName, componentName, componentKind, dependenciesUsage, dependencies) {
            var toBeIncludedModuleComponent = {
                providerName: providerName,
                componentName: componentName,
                componentKind: componentKind
            };

            if (dependenciesUsage) {
                toBeIncludedModuleComponent.dependenciesUsage = dependenciesUsage;
                toBeIncludedModuleComponent.dependencies = dependencies;
            }

            toBeIncludedModuleComponents.push(toBeIncludedModuleComponent);

            if (providerName === '$animateProvider') {
                $animateProviderUsed = true;
            }
        }


        var $animateProviderUsed = false;

        /** @type {?Function} */
        var moduleConfigFn = null;

        /**
         * @name ModuleBuilder.ToBeIncludedModuleComponent
         * @typedef {Object}
         * @property {string} type
         * @property {string} componentName
         * @property {string} componentKind
         * @property {(undefined|string)} dependenciesUsage
         * @property {(undefined|Array.<string>)} dependencies
         */

        /** @type {Object.<ModuleBuilder.ToBeIncludedModuleComponent>} */
        var toBeIncludedModuleComponents = [];

        /**
         * @param {Function} callback
         */
        this.config = function(callback) {
            moduleConfigFn = callback;
            return this;
        };

        //TODO: comment
        this.serviceWithMocks = function(serviceName) {
            includeProviderComponent('$provide', serviceName, 'withMocks');
            return this;
        };

        /**
         * Includes a service that replaces the dependencies specified in <em>toBeMockedDependencies</em> with mock
         * implementations.
         *
         * @param {string} serviceName the name of the service to be registered
         * @param {...string} toBeMockedDependencies dependencies to be replaced with a mock implementation
         * @returns {moduleBuilderFactory.ModuleBuilder} the module builder instance
         */
        this.serviceWithMocksFor = function(serviceName, toBeMockedDependencies) {
            toBeMockedDependencies = Array.prototype.slice.call(arguments, 1);
            includeProviderComponent('$provide', serviceName, 'withMocks', 'for', toBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.serviceWithMocksExcept = function(serviceName, notToBeMockedDependencies) {
            notToBeMockedDependencies = Array.prototype.slice.call(arguments, 1);
            includeProviderComponent('$provide', serviceName, 'withMocks', 'except', notToBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.filterWithMocks = function(filterName) {
            includeProviderComponent('$filterProvider', filterName, 'withMocks');
            return this;
        };

        /**
         * Includes a filter that replaces the dependencies specified in <em>toBeMockedDependencies</em> with mock
         * implementations.
         *
         * @param {string} filterName name of the filter to be included in the to be build module
         * @param {...string} toBeMockedDependencies dependencies to be replaced with a mock implementation
         * @returns {moduleBuilderFactory.ModuleBuilder} the module builder instance
         */
        this.filterWithMocksFor = function(filterName, toBeMockedDependencies) {
            includeProviderComponent('$filterProvider', filterName, 'withMocks', 'for', toBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.filterWithMocksExcept = function(filterName, notToBeMockedDependencies) {
            includeProviderComponent('$filterProvider', filterName, 'withMocks', 'except', notToBeMockedDependencies);
            return this;
        };

        //TODO: puts entry to the mockedFilters hash causing the $filter to return the mocked filter
        //  (instead of the original one).
        //TODO: decide if we only want $filter to work for explicitly registered components, which could in this case
        //  also be `...AsIs` components, (which could possible retrieve $filter using $injector.get('$filter')
        //TODO: decide if we want to expose filters with '...FilterMock' (possibly) together with '...Mock'
        //TODO: should we support mocking filters using '...WithMocks', '...WithMocksFor' and ''...WithMocksExcept' in
        //  case the filter is used as an injected service through the '...Filter' name.
        //TODO: should be using using '...WithMocks', '...WithMocksFor' and ''...WithMocksExcept' together with
        //  'filterMock' the mock always be mocked? (i.e. also when nog included in '...WithMocks')
//        this.filterMock = function(filterName) {
//            // include a filter that can be found using "...FilterMock" (or not ?!?) and also through $filter('...')
//        };

        //TODO: comment
        this.controllerWithMocks = function(controllerName) {
            includeProviderComponent('$controllerProvider', controllerName, 'withMocks');
            return this;
        };

        /**
         * Includes a controller that uses mocked service dependencies (instead of actual services) in the module.
         *
         * @param {string} controllerName name of the controller to be included in the to be build module
         * @param {...string} toBeMockedDependencies dependencies to be replaced with a mock implementation
         * @returns {moduleBuilderFactory.ModuleBuilder}
         */
        this.controllerWithMocksFor = function(controllerName, toBeMockedDependencies) {
            toBeMockedDependencies = Array.prototype.slice.call(arguments, 1);
            includeProviderComponent('$controllerProvider', controllerName, 'withMocks', 'for', toBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.controllerWithMocksExcept = function(controllerName, toBeMockedDependencies) {
            includeProviderComponent('$controllerProvider', controllerName, 'withMocks', 'except', toBeMockedDependencies);
            return this;
        };

        //TODO: puts entry to the mockedControllers hash causing the $controller to use the mocked controller
        //  (instead of the original one).
        //TODO: decide if we only want $controller to work for explicitly registered components, which could in this
        //  case also be `...AsIs` components, (which could possible retrieve $controller using
        //  $injector.get('$controller')
        //      - same should also apply when using `inject(...)` in your tests
//        this.controllerMock = function(controllerName, controllerMockConfigurator) {
//            // include a mocked controller; should support both "controller as" as traditional $scope-style
//            //  TODO: how should I mock a $scope-style controller
//            //  TODO: make sure that controllerMockConfigurator is optional
//        };

        //TODO: comment
        this.directiveWithMocks = function(directiveName) {
            includeProviderComponent('$compileProvider', directiveName, 'withMocks');
            return this;
        };

        /**
         * Includes a directive that uses mocked service dependencies (instead of actual services) in the module.
         *
         * @param {string} directiveName name of the controller to be included in the to be build module
         * @param {...string} toBeMockedDependencies dependencies to be replaced with a mock implementation
         * @returns {moduleBuilderFactory.ModuleBuilder}
         */
        this.directiveWithMocksFor = function(directiveName, toBeMockedDependencies) {
            toBeMockedDependencies = Array.prototype.slice.call(arguments, 1);
            includeProviderComponent('$compileProvider', directiveName, 'withMocks', 'for', toBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.directiveWithMocksExcept = function(directiveName, toBeMockedDependencies) {
            includeProviderComponent('$compileProvider', directiveName, 'withMocks', 'except', toBeMockedDependencies);
            return this;
        };

        //TODO: puts entry to the mockedDirectives hash causing the $compile to use the mocked directive
        //  (instead of the original one).
        //TODO: decide if we only want $compile to work for explicitly registered components, which could in this
        //  case also be `...AsIs` components, (which could possible retrieve $compile using $injector.get('$compile')
        //      - same should also apply when using `inject(...)` in your tests
//        this.directiveMock = function(directiveName, directiveMockConfigurator) {
//            // include a directive with a mocked controller but without any "link" or "compile" method;
//            // should only work if there is exactly "one" directive with the provided directiveName that has a
//            // (directive) controller
//            //  TODO: make sure that directiveMockConfigurator is optional
//        };

        //TODO: comment
        this.animationWithMocks = function(animationName) {
            includeProviderComponent('$animateProvider', animationName, 'withMocks');
            return this;
        };

        /**
         * Includes a animation that uses mocked service dependencies (instead of actual services) in the module.
         *
         * @param {string} animationName name of the controller to be included in the to be build module
         * @param {...string} toBeMockedDependencies dependencies to be replaced with a mock implementation
         * @returns {moduleBuilderFactory.ModuleBuilder}
         */
        this.animationWithMocksFor = function(animationName, toBeMockedDependencies) {
            toBeMockedDependencies = Array.prototype.slice.call(arguments, 1);
            includeProviderComponent('$animateProvider', animationName, 'withMocks', 'for', toBeMockedDependencies);
            return this;
        };

        //TODO: comment
        this.animationWithMocksExcept = function(animationName, toBeMockedDependencies) {
            includeProviderComponent('$animateProvider', animationName, 'withMocks', 'except', toBeMockedDependencies);
            return this;
        };

        /**
         * Builds ...
         * @returns {Function}
         */
        this.build = function() {

            /**
             * @param {function(object)} callback
             * @returns {Array.<string|Function>}
             */
            function configureProviders(callback) {
                return ['$provide', '$filterProvider', '$controllerProvider', '$compileProvider', '$animateProvider',
                        function($provide, $filterProvider, $controllerProvider, $compileProvider, $animateProvider) {
                    var providers = {
                        $provide: $provide,
                        $filterProvider: $filterProvider,
                        $controllerProvider: $controllerProvider,
                        $compileProvider: $compileProvider,
                        $animateProvider: $animateProvider
                    };

                    callback(providers);
                }];
            }


            var populateModuleComponents = configureProviders(function(providers) {

                function handleWithMocksComponentKind(toBeIncludedModuleComponent) {
                    var providerName = toBeIncludedModuleComponent.providerName;
                    var componentName = toBeIncludedModuleComponent.componentName;

                    var providerComponentDeclaration = getProviderComponentDeclaration(providerName, componentName);

                    /** @type {(Array.<(string|Function)>|{$get: Array.<(string|Function)})} */
                    var annotatedDeclaration = [];

                    if (providerName === '$provide') {
                        var providerMethod = providerComponentDeclaration.providerMethod;

                        if (providerMethod === 'constant' || providerMethod === 'value') {
                            throw 'Services declared with "contact" or "value" are not supported';
                        }
                    }


                    angular.forEach(providerComponentDeclaration.injectedServices, function (injectedService) {

                        if (!injector.has(injectedService)) {
                            annotatedDeclaration.push(injectedService);
                        } else {
                            var shouldBeMocked = dependencyShouldBeMocked(toBeIncludedModuleComponent, injectedService);

                            var injectedServiceInstance = injector.get(injectedService);
                            var canBeMocked = mockCreator.canInstanceBeMocked(injectedServiceInstance);

                            if (shouldBeMocked && !canBeMocked &&
                                toBeIncludedModuleComponent.dependenciesUsage === 'for') {
                                throw 'Could not mock the dependency explicitly asked to mock: ' + injectedService;
                            }

                            var toBeMocked = shouldBeMocked && canBeMocked;

                            if (toBeMocked) {
                                mockedServices[injectedService] = injectedServiceInstance;
                            }

                            annotatedDeclaration.push(injectedService + (toBeMocked ? 'Mock' : ''));
                        }
                    });

                    annotatedDeclaration.push(providerComponentDeclaration.strippedDeclaration);

                    if (providerName === '$provide' && providerComponentDeclaration.providerMethod === 'provider') {
                        var $provideProviderDeclaration =
                            introspector.getProviderDeclaration(componentName + 'Provider');

                        if (angular.isFunction($provideProviderDeclaration.strippedDeclaration)) {
                            var original$provideProviderFactory = $provideProviderDeclaration.strippedDeclaration;

                            var originalAnnotatedDeclaration = annotatedDeclaration;

                            var modified$ProvideProviderFactory = function() {
                                var result = original$provideProviderFactory.apply(this, arguments);
                                var instance = angular.isObject(result) ? result : this;
                                instance.$get = originalAnnotatedDeclaration;
                                return result;
                            };

                            annotatedDeclaration =
                                Array.prototype.slice.call($provideProviderDeclaration.injectedProviders);
                            annotatedDeclaration.push(modified$ProvideProviderFactory);
                        } else {
                            annotatedDeclaration = {$get: annotatedDeclaration};
                        }
                    }

                    declarations[componentName] = {
                        providerName: providerName,
                        providerMethod: providerComponentDeclaration.providerMethod,
                        declaration: annotatedDeclaration
                    };
                }

                function getProviderComponentDeclaration(providerName, componentName) {
                    var providerComponentDeclarations = introspector.getProviderComponentDeclarations(providerName, componentName);

                    if (providerComponentDeclarations.length === 1) {
                        return providerComponentDeclarations[0];
                    } else if (providerComponentDeclarations.length === 2 && providerName === '$compilerProvider' &&
                            providerComponentDeclarations[0].builtIn !== providerComponentDeclarations[0].builtIn) {
                        return !providerComponentDeclarations[0].builtIn ? providerComponentDeclarations[0] :
                                providerComponentDeclarations[1];
                    } else {
                        throw new Error('Could not determine unique component declaration for provider "' + providerName + '":' +
                                componentName);
                    }

                }

                function dependencyShouldBeMocked(toBeIncludedModuleComponent, dependencyName) {
                    var dependenciesUsage = toBeIncludedModuleComponent.dependenciesUsage;

                    if (dependenciesUsage === 'for') {
                        return toBeIncludedModuleComponent.dependencies.indexOf(dependencyName) !== -1;
                    } else if (dependenciesUsage === 'except') {
                        return toBeIncludedModuleComponent.dependencies.indexOf(dependencyName) === -1;
                    } else if (!dependenciesUsage) {
                        return true;
                    } else {
                        throw 'Invalid dependencies usage: ' + dependenciesUsage;
                    }
                }

                function ensureModuleExist(moduleName) {
                    angular.module(moduleName);
                }

                function valueFn(value) {
                    return function() {
                        return value;
                    };
                }


                /** @type Object.<Object> */
                var mockedServices = {};

                /**
                 * @type {Object.<{providerName: string, providerMethod: string, declaration: Array.<(string|Function)>}>}
                 */
                var declarations = {};


                // ensure that the module exists. Throws an [$injector:nomod] whenever it not exists
                ensureModuleExist(moduleName);


                var injectorModules = ['ng', 'ngMock'];

                injectorModules.push(moduleName);

                if (moduleConfigFn) {
                    injectorModules.push(moduleConfigFn);
                }

                var introspector = moduleIntrospector(moduleName, true);

                var injector = /** @type {$injector} */ angular.injector(injectorModules);


                if ($animateProviderUsed) {
                    var $animate = injector.get('$animate');

                    if ($animate.enabled === angular.noop) {
                        throw 'Animations are included in the to be build module, but the original module did not ' +
                                'the "ngAnimate" module: ' + moduleName;
                    }
                }


                angular.forEach(toBeIncludedModuleComponents, function(toBeIncludedModuleComponent) {
                    if (toBeIncludedModuleComponent.componentKind === 'withMocks') {
                        handleWithMocksComponentKind(toBeIncludedModuleComponent);
                    }
                });


                angular.forEach(mockedServices, function (originalService, serviceName) {
                    var mockedService = mockCreator.mockInstance(originalService);
                    providers.$provide.value(serviceName + 'Mock', mockedService);
                });

                angular.forEach(declarations, function (declarationInfo, declarationName) {
                    if (declarationInfo.providerName !== '$compileProvider') {
                        providers[declarationInfo.providerName][declarationInfo.providerMethod](
                            declarationName, declarationInfo.declaration);
                    } else {
                        providers.$provide.decorator(declarationName + 'Directive', function($delegate, $injector) {
                            var index = $delegate.length === 1 ? 0 : (!$delegate[0].builtIn ? 0 : 1);

                            var directive = $injector.invoke(declarationInfo.declaration);

                            if (angular.isFunction(directive)) {
                                $delegate[index].compile = valueFn(directive);
                            } else if (!directive.compile && directive.link) {
                                $delegate[index].compile = valueFn(directive.link);
                            }

                            if (directive.link) {
                                $delegate[index].link = directive.link;
                            }

                            if (directive.controller) {
                                $delegate[index].controller = directive.controller;
                            }

                            return $delegate;
                        });
                    }
                });
            });


            return angular.mock.module(moduleName, populateModuleComponents, 'ngImprovedTesting');
        };

    }

    /**
     * @ngdoc service
     * @name moduleBuilder
     */
    return {
        /**
         * @name moduleBuilder#forModule
         * @param {string} moduleName
         * @returns {moduleBuilderFactory.ModuleBuilder}
         */
        forModule: function(moduleName) {
            return new ModuleBuilder(moduleName);
        }
    };

}
moduleBuilderFactory.$inject = ["moduleIntrospector", "mockCreator"];


angular.module('ngImprovedTesting.internal.moduleBuilder', [
        'ngModuleIntrospector',
        'ngImprovedTesting.internal.mockCreator'
    ])
    .factory('moduleBuilder', moduleBuilderFactory);

var ngModuleIntrospectorInjector = angular.injector(['ng', 'ngModuleIntrospector']);
var moduleIntrospectorFactory = ngModuleIntrospectorInjector.get('moduleIntrospector');
var moduleIntrospector = moduleIntrospectorFactory('ng');

var original$QProviderConstructor = moduleIntrospector.getProviderDeclaration('$qProvider').rawDeclaration;
var ngInjector = angular.injector(['ng']);
var original$QProviderInstance = ngInjector.instantiate(original$QProviderConstructor, {});


angular.module('ngImprovedTesting.$q', ['ngImprovedTesting.internal.config'])

    /**
     * @ngdoc service
     * @name $q
     * @module ngImprovedTesting
     * @description
     * TODO: add description
     */
    .provider('$q', ["ngImprovedTestingConfigFlags", function(ngImprovedTestingConfigFlags) {
        this.$get = ["$rootScope", "$exceptionHandler", function($rootScope, $exceptionHandler) {
            /** @type {?Array.<function()>} */
            var executeOnNextTick = null;

            if (ngImprovedTestingConfigFlags.$qTick) {
                executeOnNextTick = [];

                $rootScope = {
                    $evalAsync: function (callback) {
                        executeOnNextTick.push(callback);
                    }
                };
            }

            var result = original$QProviderInstance.$get[original$QProviderInstance.$get.length - 1](
                    $rootScope, $exceptionHandler);

            if (ngImprovedTestingConfigFlags.$qTick) {
                /**
                 * @ngdoc method
                 * @name $q#tick
                 * @description
                 * TODO: add description
                 */
                result.tick = function () {
                    while (executeOnNextTick.length) {
                        var previousExecuteOnNextTick = executeOnNextTick.slice(0);

                        executeOnNextTick.length = 0;
                        for (var i = 0; i < previousExecuteOnNextTick.length; i += 1) {
                            previousExecuteOnNextTick[i]();
                        }
                    }
                };
            }

            return result;
        }];
    }]);

var injector = angular.injector([
        'ng',
        'ngImprovedTesting.internal.config',
        'ngImprovedTesting.internal.mockCreator',
        'ngImprovedTesting.internal.moduleBuilder'
    ]);


var mockCreator = injector.get('mockCreator');

window.ngImprovedTesting = {
    mockInstance: mockCreator.mockInstance,
    config: injector.get('ngImprovedTestingConfig')
};

window.mockInstance = window.ngImprovedTesting.mockInstance;

window.ModuleBuilder = injector.get('moduleBuilder');

}());
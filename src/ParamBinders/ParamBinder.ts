export type ParamBinderConstructorParams<TModel, TModelValue> = {
    /**
     * Name of url parameter to bind to
     */
    urlParamName: string;
    /**
     * Default value of url parameter, will be used if url parameter is invalid
     * or empty. Can be string or function that returns `Promise<string>` function
     * has one parameter of `URLSearchParams` type.
     */
    defaultParamValue:
        | string
        | ((allParams?: URLSearchParams) => Promise<string>);
    /**
     * Function to set value to model
     */
    setValueToModel: (model: TModel, value: TModelValue) => void;
    /**
     * Function to get url parameter value from model.
     */
    getUrlParamValue: (model: TModel) => Promise<string>;
    /**
     * Checks if model is consistent.
     * To be called when all parsing is done and `model` is ready for final validation.
     * Sometimes it can be useful to have it.
     * For example if you have a model with two fields and you want to check
     * if value of one field is consistent with value of another field.
     * e.g. if you have a model with fields `from` and `to` and you want to
     * check if `from` is less than `to`.
     * This method can be called and return `false` if model is not consistent.
     * If no `isModelConsistent` function is provided it will return `true` by default.
     */
    isModelConsistent?: (model: TModel) => Promise<boolean>;

    /**
     * Checks if url parameter value is valid.
     */
    isUrlParamValueValid: (
        value: string,
        allParams?: URLSearchParams
    ) => Promise<boolean>;
};

export class ParamBinder<TModel, TModelValue> {
    #urlParamName: string;

    /**
     * Name of url parameter to bind to,
     * set through constructor parameter
     */
    public get urlParamName(): string {
        return this.#urlParamName;
    }

    protected set urlParamName(value: string) {
        if (!value || typeof value !== 'string') {
            throw new Error('urlParamName must be non empty string');
        }
        this.#urlParamName = value;
    }

    #defaultParamValue: ParamBinderConstructorParams<
        TModel,
        TModelValue
    >['defaultParamValue'];

    /**
     * Get default value of url parameter, will be used if url parameter is invalid
     * or empty.
     */
    public async getDefaultParamValue(
        allParams?: URLSearchParams
    ): Promise<string> {
        if (typeof this.#defaultParamValue === 'function') {
            return await this.#defaultParamValue(allParams);
        }
        return this.#defaultParamValue;
    }

    protected set defaultParamValue(
        value: string | ((allParams?: URLSearchParams) => Promise<string>)
    ) {
        if (typeof value !== 'string' && typeof value !== 'function') {
            throw new Error('defaultValue must be string or function');
        }
        this.#defaultParamValue = value;
    }

    protected isModelConsistentFunc: (model: TModel) => Promise<boolean>;
    protected isUrlParamValueValidFunc: (
        value: string,
        allParams?: URLSearchParams
    ) => Promise<boolean>;
    protected getUrlParamValueFunc: (model: TModel) => Promise<string>;
    protected setValueToModelFunc: (model: TModel, value: TModelValue) => void;

    constructor({
        urlParamName,
        defaultParamValue,
        setValueToModel,
        isModelConsistent,
        isUrlParamValueValid,
        getUrlParamValue
    }: ParamBinderConstructorParams<TModel, TModelValue>) {
        if (!urlParamName || typeof urlParamName !== 'string') {
            throw new Error('urlParamName must be non empty string');
        }
        this.urlParamName = urlParamName;

        if (
            typeof defaultParamValue !== 'string' &&
            typeof defaultParamValue !== 'function'
        ) {
            throw new Error('defaultValue must be string or function');
        }
        this.defaultParamValue = defaultParamValue;

        if (typeof setValueToModel !== 'function') {
            throw new Error('setValueToModel must be function');
        }
        this.setValueToModelFunc = setValueToModel;

        if (typeof isModelConsistent === 'function') {
            this.isModelConsistentFunc = isModelConsistent;
        }

        if (typeof isUrlParamValueValid !== 'function') {
            throw new Error('isUrlParamValueValid must be function');
        }
        this.isUrlParamValueValidFunc = isUrlParamValueValid;

        if (typeof getUrlParamValue !== 'function') {
            throw new Error('getUrlParamValue must be function');
        }
        this.getUrlParamValueFunc = getUrlParamValue;
    }

    /**
     * Parses url parameter value, returns default value if it's invalid.
     * `value` is returned if it's valid.
     * @param value - value of url parameter to parse
     * @param allParams - all url parameters
     */
    async parseUrlParamValue(
        value: string,
        allParams?: URLSearchParams
    ): Promise<string> {
        if (!(await this.isUrlParamValid(value, allParams))) {
            return await this.getDefaultParamValue(allParams);
        }
        return value;
    }

    /**
     * Returns value of url parameter from model. Can be overriden in child classes.
     * @param model A Model to get value from
     */
    async getUrlParamValue(model: TModel): Promise<string> {
        const valToReturn = await this.getUrlParamValueFunc(model);
        return valToReturn === undefined || valToReturn === null
            ? await this.getDefaultParamValue()
            : valToReturn.toString();
    }

    /**
     * @virtual
     * Set value to model. Should be overriden in child classes.
     * @param model Model to set value to
     * @param urlParamValue value of url parameter
     */
    async setToModel(model: TModel, urlParamValue: TModelValue): Promise<void> {
        if (typeof model !== 'object' || model === null) {
            throw new Error('model must be a non-null object');
        }
        this.setValueToModelFunc(model, urlParamValue);
    }

    /**
     * Checks if model is consistent. See `isModelConsistent` constructor parameter.
     * @param model a Model to check
     * @returns Promise with `true` if model is consistent, `false` otherwise
     */
    async isModelConsistent(model: TModel): Promise<boolean> {
        if (typeof this.isModelConsistentFunc === 'function') {
            return this.isModelConsistentFunc(model);
        }
        return true;
    }

    /**
     * Check if url parameter value is valid. Calls a `isUrlParamValueValid` function
     * provided in constructor.
     * Example: you can check if url parameter is a valid date or a valid number.
     * If it's not valid you can return `true` and default value will be set to the
     * Model instead.
     * @param str value of url parameter to validate
     * @param [allParams] all url parameters - optional
     */
    isUrlParamValid(
        str: string,
        allParams?: URLSearchParams
    ): Promise<boolean> {
        return this.isUrlParamValueValidFunc(str, allParams);
    }
}

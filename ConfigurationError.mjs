class ConfigurationError extends Error {
    constructor(subject, operation, expected, got, ...options) {
        super(...options);
        this.message = `Configuration error when doing ${operation.name} on ${subject}:
Expected: ${expected}
Got: 
  Type: ${typeof(got)}
  Value: ${got} 
`
    }
}

export { ConfigurationError };
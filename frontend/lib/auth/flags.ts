export function isVerificationDisabled() {
    return (
        process.env.DISABLE_VERIFICATION === "1" ||
        process.env.NODE_ENV !== "production"
    )
}

export function isEmailVerified(value: boolean | null | undefined) {
    return value === true
}

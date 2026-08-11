package com.hotelbooking.auth.exception;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        // Deliberately does not reveal whether the email exists — that difference is
        // an account-enumeration oracle.
        super("Invalid email or password");
    }
}

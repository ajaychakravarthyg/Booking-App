package com.hotelbooking.auth.exception;

public class EmailAlreadyUsedException extends RuntimeException {

    public EmailAlreadyUsedException(String email) {
        super("An account with email '" + email + "' already exists");
    }
}

package com.hotelbooking.room.exception;

public class DuplicateRoomNumberException extends RuntimeException {

    public DuplicateRoomNumberException(String roomNumber) {
        super("A room numbered '" + roomNumber + "' already exists");
    }
}

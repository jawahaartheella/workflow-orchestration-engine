import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { TestResourceModel } from "./test-resource.model.js";

export const getTestResource: RequestHandler = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tenantId = res.locals.tenantId as string;

        console.log(id);
        console.log(tenantId);

        if(typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
            res.status(400).json({
                message: 'Invalid resource ID'
            });
            return;
        }

        const resource = await TestResourceModel.findOne({
            _id: id,
            tenantId
        });

        if(!resource) {
            res.status(404).json({
                message: "Resource not found"
            });
            return;
        }

        res.status(200).json({
            message: "Resource retrived successfully",
            data: resource
        });
    } catch (error) {
        next(error);
    }
}
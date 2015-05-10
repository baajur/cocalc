#!/usr/bin/env python

max_snapshots = 30

TIMESTAMP_FORMAT = "%Y-%m-%d-%H%M%S"

import time, os

def create(args):
    cmd = "btrfs subvolume snapshot -r /mnt/cassandra /mnt/cassandra/.snapshots/%s"%time.strftime("%Y-%m-%d-%H%M%S")
    print cmd
    os.system(cmd)

def delete(args):
    v = os.listdir("/mnt/cassandra/.snapshots/") 
    v.sort()
    if len(v) > max_snapshots:
        for snapshot in v[:len(v)-max_snapshots]:
            cmd = "btrfs subvolume delete /mnt/cassandra/.snapshots/%s"%snapshot
            print cmd
            os.system(cmd)
     
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="snapshot cassandra disk")
    subparsers = parser.add_subparsers(help="sub")

    sub_create = subparsers.add_parser('create')
    sub_create.set_defaults(func=create)

    sub_delete = subparsers.add_parser('delete')
    sub_delete.set_defaults(func=delete)

    args = parser.parse_args()
    args.func(args)

